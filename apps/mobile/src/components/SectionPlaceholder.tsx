import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppSectionMeta } from '@farmdb/core';

interface SectionPlaceholderProps {
  section: AppSectionMeta;
  tableName: string;
  recordCount: number;
}

export function SectionPlaceholder({
  section,
  tableName,
  recordCount,
}: SectionPlaceholderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.badge}>Phase {section.phase} Module</Text>
        <Text style={styles.title}>{section.label}</Text>
        <Text style={styles.description}>{section.description}</Text>

        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>SQLite Table Initialized</Text>
          <Text style={styles.metaValue}>{tableName}</Text>
          <Text style={styles.metaCount}>Current Rows: {recordCount}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 12,
    padding: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e6f2ec',
    color: '#2d6a4f',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c241e',
  },
  description: {
    fontSize: 14,
    color: '#5d675f',
    marginTop: 6,
    lineHeight: 20,
  },
  metaBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f5f3ee',
  },
  metaLabel: {
    fontSize: 12,
    color: '#5d675f',
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c241e',
    marginTop: 2,
  },
  metaCount: {
    fontSize: 13,
    color: '#2d6a4f',
    fontWeight: '600',
    marginTop: 4,
  },
});
