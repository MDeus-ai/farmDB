use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tauri::Manager;

const SQLITE_MAGIC: &[u8; 16] = b"SQLite format 3\0";

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SqliteStorageConfig {
    #[serde(default)]
    custom_db_dir: Option<String>,
    #[serde(default = "default_true")]
    read_only_protection: bool,
}

impl Default for SqliteStorageConfig {
    fn default() -> Self {
        Self {
            custom_db_dir: None,
            read_only_protection: true,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SqliteStorageInfo {
    db_path: String,
    default_db_path: String,
    storage_dir: String,
    is_custom_location: bool,
    read_only_protection: bool,
    is_file_read_only: bool,
    file_size_bytes: u64,
}

fn allowed_image_extension(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" => Some(ext),
        _ => None,
    }
}

fn sanitize_stem(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('-');
    if trimmed.is_empty() {
        "animal".to_string()
    } else {
        trimmed.chars().take(64).collect()
    }
}

fn validate_sqlite_file(path: &Path) -> Result<u64, String> {
    if !path.is_file() {
        return Err("Selected backup file does not exist.".to_string());
    }
    let meta = std::fs::metadata(path)
        .map_err(|e| format!("Failed to inspect backup file: {e}"))?;
    if meta.len() < 100 {
        return Err("Selected file is too small to be a valid SQLite database.".to_string());
    }

    let mut file = File::open(path)
        .map_err(|e| format!("Failed to open backup file: {e}"))?;
    let mut header = [0u8; 16];
    file.read_exact(&mut header)
        .map_err(|e| format!("Failed to read SQLite header: {e}"))?;

    if &header != SQLITE_MAGIC {
        return Err("Selected file is not a valid SQLite 3 database (.db).".to_string());
    }

    Ok(meta.len())
}

fn storage_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config directory: {e}"))?;
    Ok(config_dir.join("sqlite-storage-config.json"))
}

fn default_sqlite_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config directory: {e}"))?;
    Ok(config_dir.join("farmdb.db"))
}

fn shadow_backup_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let local_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to resolve local data directory: {e}"))?;
    Ok(local_dir.join("protected").join("farmdb.verified.db"))
}

fn load_storage_config(app: &tauri::AppHandle) -> SqliteStorageConfig {
    let Ok(cfg_path) = storage_config_path(app) else {
        return SqliteStorageConfig::default();
    };
    let Ok(raw) = std::fs::read_to_string(cfg_path) else {
        return SqliteStorageConfig::default();
    };
    serde_json::from_str::<SqliteStorageConfig>(&raw).unwrap_or_default()
}

fn save_storage_config(
    app: &tauri::AppHandle,
    config: &SqliteStorageConfig,
) -> Result<(), String> {
    let cfg_path = storage_config_path(app)?;
    if let Some(parent) = cfg_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize storage config: {e}"))?;
    std::fs::write(&cfg_path, json.as_bytes())
        .map_err(|e| format!("Failed to save storage config: {e}"))
}

fn resolve_sqlite_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let cfg = load_storage_config(app);
    if let Some(custom_dir) = cfg.custom_db_dir {
        let trimmed = custom_dir.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed).join("farmdb.db"));
        }
    }
    default_sqlite_db_path(app)
}

fn set_single_file_readonly(path: &Path, readonly: bool) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let meta = std::fs::metadata(path)
        .map_err(|e| format!("Failed to inspect file permissions: {e}"))?;
    let mut perms = meta.permissions();
    perms.set_readonly(readonly);
    std::fs::set_permissions(path, perms)
        .map_err(|e| format!("Failed to update file read-only state: {e}"))
}

fn wal_sidecar_paths(db_path: &Path) -> [PathBuf; 4] {
    let base = db_path.to_string_lossy();
    [
        PathBuf::from(format!("{base}-wal")),
        PathBuf::from(format!("{base}-shm")),
        db_path.with_extension("db-wal"),
        db_path.with_extension("db-shm"),
    ]
}

fn set_db_files_readonly(db_path: &Path, readonly: bool) -> Result<(), String> {
    set_single_file_readonly(db_path, readonly)?;
    for sidecar in wal_sidecar_paths(db_path) {
        let _ = set_single_file_readonly(&sidecar, readonly);
    }
    Ok(())
}

fn remove_wal_sidecars(db_path: &Path) {
    for sidecar in wal_sidecar_paths(db_path) {
        if sidecar.exists() {
            let _ = set_single_file_readonly(&sidecar, false);
            let _ = std::fs::remove_file(&sidecar);
        }
    }
}

fn update_shadow_backup(app: &tauri::AppHandle, db_path: &Path) -> Result<(), String> {
    if !db_path.is_file() || validate_sqlite_file(db_path).is_err() {
        return Ok(());
    }
    let shadow = shadow_backup_path(app)?;
    if let Some(parent) = shadow.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create protected backup directory: {e}"))?;
    }
    let _ = set_single_file_readonly(&shadow, false);
    std::fs::copy(db_path, &shadow)
        .map_err(|e| format!("Failed to update verified shadow copy: {e}"))?;
    let _ = set_single_file_readonly(&shadow, true);
    Ok(())
}

fn build_storage_info(app: &tauri::AppHandle) -> Result<SqliteStorageInfo, String> {
    let cfg = load_storage_config(app);
    let db_path = resolve_sqlite_db_path(app)?;
    let default_path = default_sqlite_db_path(app)?;
    let storage_dir = db_path
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let meta = std::fs::metadata(&db_path).ok();
    let is_file_read_only = meta
        .as_ref()
        .map(|m| m.permissions().readonly())
        .unwrap_or(false);
    let file_size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
    let is_custom_location = db_path != default_path;

    Ok(SqliteStorageInfo {
        db_path: db_path.to_string_lossy().into_owned(),
        default_db_path: default_path.to_string_lossy().into_owned(),
        storage_dir,
        is_custom_location,
        read_only_protection: cfg.read_only_protection,
        is_file_read_only,
        file_size_bytes,
    })
}

#[tauri::command]
fn import_livestock_image(
    app: tauri::AppHandle,
    source_path: String,
    file_stem: String,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.is_file() {
        return Err("Selected image file does not exist.".to_string());
    }

    let ext = allowed_image_extension(&source)
        .ok_or_else(|| "Unsupported image format. Choose PNG, JPG, WEBP, GIF, or BMP.".to_string())?;

    let images_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to resolve local data directory: {e}"))?
        .join("images");

    std::fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Failed to create local images directory: {e}"))?;

    let dest_path = images_dir.join(format!("{}.{}", sanitize_stem(&file_stem), ext));
    std::fs::copy(&source, &dest_path)
        .map_err(|e| format!("Failed to copy image into local storage: {e}"))?;

    Ok(dest_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn delete_livestock_image(app: tauri::AppHandle, image_path: String) -> Result<(), String> {
    let images_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to resolve local data directory: {e}"))?
        .join("images");

    if !images_dir.exists() {
        return Ok(());
    }

    let target = PathBuf::from(&image_path);
    if !target.exists() {
        return Ok(());
    }

    let canon_dir = images_dir
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize images directory: {e}"))?;
    let canon_target = target
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize target image: {e}"))?;

    if !canon_target.starts_with(&canon_dir) {
        return Err("Refusing to delete a file outside the managed farmDB images directory.".to_string());
    }

    if canon_target.is_file() {
        std::fs::remove_file(&canon_target)
            .map_err(|e| format!("Failed to remove image file: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
fn write_text_export_file(dest_path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&dest_path);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to prepare export directory: {e}"))?;
    }
    std::fs::write(&target, content.as_bytes())
        .map_err(|e| format!("Failed to write export file: {e}"))
}

#[tauri::command]
fn write_csv_export_bundle(
    folder_path: String,
    subfolder_name: String,
    files: Vec<(String, String)>,
) -> Result<Vec<String>, String> {
    let safe_sub = sanitize_stem(&subfolder_name);
    let export_dir = PathBuf::from(&folder_path).join(safe_sub);
    std::fs::create_dir_all(&export_dir)
        .map_err(|e| format!("Failed to create CSV export folder: {e}"))?;

    let mut written = Vec::with_capacity(files.len());
    for (filename, content) in files {
        let name_only = Path::new(&filename)
            .file_name()
            .and_then(|s| s.to_str())
            .ok_or_else(|| format!("Invalid export filename: {filename}"))?;
        let dest = export_dir.join(name_only);
        std::fs::write(&dest, content.as_bytes())
            .map_err(|e| format!("Failed to write {name_only}: {e}"))?;
        written.push(dest.to_string_lossy().into_owned());
    }

    Ok(written)
}

#[tauri::command]
fn read_text_import_file(source_path: String) -> Result<String, String> {
    std::fs::read_to_string(&source_path)
        .map_err(|e| format!("Failed to read selected JSON file: {e}"))
}

#[tauri::command]
fn get_sqlite_db_path(app: tauri::AppHandle) -> Result<String, String> {
    let path = resolve_sqlite_db_path(&app)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn get_sqlite_storage_info(app: tauri::AppHandle) -> Result<SqliteStorageInfo, String> {
    build_storage_info(&app)
}

#[tauri::command]
fn prepare_sqlite_storage(app: tauri::AppHandle) -> Result<String, String> {
    let db_path = resolve_sqlite_db_path(&app)?;
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to prepare database directory: {e}"))?;
    }

    let shadow = shadow_backup_path(&app)?;
    let shadow_valid = shadow.is_file() && validate_sqlite_file(&shadow).is_ok();

    if db_path.is_file() {
        let len = std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);
        if validate_sqlite_file(&db_path).is_err() && shadow_valid {
            remove_wal_sidecars(&db_path);
            let _ = set_db_files_readonly(&db_path, false);
            std::fs::copy(&shadow, &db_path)
                .map_err(|e| format!("Failed to restore verified database copy: {e}"))?;
        } else if len == 0 && !shadow_valid {
            let _ = set_single_file_readonly(&db_path, false);
            let _ = std::fs::remove_file(&db_path);
        }
    } else if shadow_valid {
        std::fs::copy(&shadow, &db_path)
            .map_err(|e| format!("Failed to restore database from shadow backup: {e}"))?;
    }

    set_db_files_readonly(&db_path, false)?;
    Ok(db_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn set_sqlite_write_lock(app: tauri::AppHandle, locked: bool) -> Result<(), String> {
    let cfg = load_storage_config(&app);
    let db_path = resolve_sqlite_db_path(&app)?;
    if !locked {
        set_db_files_readonly(&db_path, false)?;
    } else if cfg.read_only_protection {
        let _ = update_shadow_backup(&app, &db_path);
        let _ = set_db_files_readonly(&db_path, true);
    }
    Ok(())
}

#[tauri::command]
fn set_sqlite_readonly_protection(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<SqliteStorageInfo, String> {
    let mut cfg = load_storage_config(&app);
    cfg.read_only_protection = enabled;
    save_storage_config(&app, &cfg)?;

    let db_path = resolve_sqlite_db_path(&app)?;
    if enabled {
        let _ = update_shadow_backup(&app, &db_path);
        let _ = set_db_files_readonly(&db_path, true);
    } else {
        set_db_files_readonly(&db_path, false)?;
    }
    build_storage_info(&app)
}

#[tauri::command]
fn relocate_sqlite_storage(
    app: tauri::AppHandle,
    target_dir: String,
) -> Result<SqliteStorageInfo, String> {
    let trimmed = target_dir.trim();
    if trimmed.is_empty() {
        return Err("Select a valid destination folder for the SQLite database.".to_string());
    }

    let mut cfg = load_storage_config(&app);
    let old_path = resolve_sqlite_db_path(&app)?;
    let dest_dir = PathBuf::from(trimmed);
    std::fs::create_dir_all(&dest_dir)
        .map_err(|e| format!("Failed to create target storage folder: {e}"))?;
    let new_path = dest_dir.join("farmdb.db");

    if old_path != new_path {
        if old_path.is_file() {
            set_db_files_readonly(&old_path, false)?;
            let _ = set_db_files_readonly(&new_path, false);
            remove_wal_sidecars(&new_path);
            std::fs::copy(&old_path, &new_path)
                .map_err(|e| format!("Failed to copy SQLite database to selected folder: {e}"))?;
            validate_sqlite_file(&new_path)?;
        }
        cfg.custom_db_dir = Some(dest_dir.to_string_lossy().into_owned());
        save_storage_config(&app, &cfg)?;

        if old_path.is_file() {
            let _ = set_db_files_readonly(&old_path, false);
            remove_wal_sidecars(&old_path);
            let _ = std::fs::remove_file(&old_path);
        }
    } else {
        cfg.custom_db_dir = Some(dest_dir.to_string_lossy().into_owned());
        save_storage_config(&app, &cfg)?;
    }

    if cfg.read_only_protection {
        let _ = update_shadow_backup(&app, &new_path);
        let _ = set_db_files_readonly(&new_path, true);
    } else {
        let _ = set_db_files_readonly(&new_path, false);
    }

    build_storage_info(&app)
}

#[tauri::command]
fn reset_sqlite_storage_location(app: tauri::AppHandle) -> Result<SqliteStorageInfo, String> {
    let mut cfg = load_storage_config(&app);
    let old_path = resolve_sqlite_db_path(&app)?;
    let default_path = default_sqlite_db_path(&app)?;

    if let Some(parent) = default_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to prepare default database folder: {e}"))?;
    }

    if old_path != default_path && old_path.is_file() {
        set_db_files_readonly(&old_path, false)?;
        let _ = set_db_files_readonly(&default_path, false);
        remove_wal_sidecars(&default_path);
        std::fs::copy(&old_path, &default_path)
            .map_err(|e| format!("Failed to move SQLite database back to default folder: {e}"))?;
        validate_sqlite_file(&default_path)?;
        remove_wal_sidecars(&old_path);
        let _ = std::fs::remove_file(&old_path);
    }

    cfg.custom_db_dir = None;
    save_storage_config(&app, &cfg)?;

    if cfg.read_only_protection {
        let _ = update_shadow_backup(&app, &default_path);
        let _ = set_db_files_readonly(&default_path, true);
    } else {
        let _ = set_db_files_readonly(&default_path, false);
    }

    build_storage_info(&app)
}

fn encode_base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((bytes.len() + 2) / 3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((triple >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize] as char);
        out.push(if chunk.len() > 1 {
            TABLE[((triple >> 6) & 0x3F) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[(triple & 0x3F) as usize] as char
        } else {
            '='
        });
    }
    out
}

#[tauri::command]
fn read_image_file_as_data_url(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if !path.is_file() {
        return Err("Selected image file does not exist.".to_string());
    }
    let ext = allowed_image_extension(&path)
        .ok_or_else(|| "Unsupported image extension.".to_string())?;
    let meta = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to inspect image file: {e}"))?;
    if meta.len() > 12 * 1024 * 1024 {
        return Err("Image file exceeds maximum 12 MB size.".to_string());
    }
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Failed to read image file: {e}"))?;
    let mime = match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    };
    Ok(format!("data:{mime};base64,{}", encode_base64(&bytes)))
}

#[tauri::command]
fn copy_sqlite_backup(app: tauri::AppHandle, dest_path: String) -> Result<String, String> {
    let db_path = resolve_sqlite_db_path(&app)?;
    if !db_path.is_file() {
        return Err("Local SQLite database file was not found.".to_string());
    }
    let dest = PathBuf::from(&dest_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to prepare backup folder: {e}"))?;
    }
    let _ = set_single_file_readonly(&dest, false);
    std::fs::copy(&db_path, &dest)
        .map_err(|e| format!("Failed to copy SQLite backup: {e}"))?;
    let _ = set_single_file_readonly(&dest, false);
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
fn validate_sqlite_backup_file(source_path: String) -> Result<u64, String> {
    validate_sqlite_file(Path::new(&source_path))
}

#[tauri::command]
fn replace_sqlite_db_from_backup(
    app: tauri::AppHandle,
    source_path: String,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    validate_sqlite_file(&source)?;

    let cfg = load_storage_config(&app);
    let db_path = resolve_sqlite_db_path(&app)?;
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create database directory: {e}"))?;
    }

    let _ = set_db_files_readonly(&db_path, false);

    let backup_prev = db_path.with_extension("db.pre-restore.bak");
    if db_path.is_file() {
        let _ = set_single_file_readonly(&backup_prev, false);
        std::fs::copy(&db_path, &backup_prev)
            .map_err(|e| format!("Failed to create pre-restore safety backup: {e}"))?;
    }

    remove_wal_sidecars(&db_path);

    if let Err(err) = std::fs::copy(&source, &db_path) {
        if backup_prev.is_file() {
            let _ = std::fs::copy(&backup_prev, &db_path);
        }
        if cfg.read_only_protection {
            let _ = set_db_files_readonly(&db_path, true);
        }
        return Err(format!("Failed to restore SQLite database: {err}"));
    }

    let _ = set_single_file_readonly(&db_path, false);
    let _ = update_shadow_backup(&app, &db_path);
    if cfg.read_only_protection {
        let _ = set_db_files_readonly(&db_path, true);
    }

    Ok(db_path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            import_livestock_image,
            delete_livestock_image,
            read_image_file_as_data_url,
            write_text_export_file,
            write_csv_export_bundle,
            read_text_import_file,
            get_sqlite_db_path,
            get_sqlite_storage_info,
            prepare_sqlite_storage,
            set_sqlite_write_lock,
            set_sqlite_readonly_protection,
            relocate_sqlite_storage,
            reset_sqlite_storage_location,
            copy_sqlite_backup,
            validate_sqlite_backup_file,
            replace_sqlite_db_from_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running farmDB desktop application");
}
