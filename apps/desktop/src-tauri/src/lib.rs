use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::Manager;

const SQLITE_MAGIC: &[u8; 16] = b"SQLite format 3\0";

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

fn resolve_sqlite_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config directory: {e}"))?;
    Ok(config_dir.join("farmdb.db"))
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
    std::fs::copy(&db_path, &dest)
        .map_err(|e| format!("Failed to copy SQLite backup: {e}"))?;
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

    let db_path = resolve_sqlite_db_path(&app)?;
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create database directory: {e}"))?;
    }

    let backup_prev = db_path.with_extension("db.pre-restore.bak");
    if db_path.is_file() {
        std::fs::copy(&db_path, &backup_prev)
            .map_err(|e| format!("Failed to create pre-restore safety backup: {e}"))?;
    }

    for suffix in ["db-wal", "db-shm"] {
        let sidecar = db_path.with_extension(suffix);
        if sidecar.exists() {
            let _ = std::fs::remove_file(&sidecar);
        }
    }

    if let Err(err) = std::fs::copy(&source, &db_path) {
        if backup_prev.is_file() {
            let _ = std::fs::copy(&backup_prev, &db_path);
        }
        return Err(format!("Failed to restore SQLite database: {err}"));
    }

    Ok(db_path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            import_livestock_image,
            delete_livestock_image,
            write_text_export_file,
            write_csv_export_bundle,
            read_text_import_file,
            get_sqlite_db_path,
            copy_sqlite_backup,
            validate_sqlite_backup_file,
            replace_sqlite_db_from_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running farmDB desktop application");
}
