'use strict';

const path = require('path');
const Database = require(path.join(__dirname, 'backend-node', 'node_modules', 'better-sqlite3'));

const dbPath = process.argv[2];
if (!dbPath) throw new Error('Usage: node AUDIT-CLEAN-DATABASE.js <drama_generator.db>');

const db = new Database(path.resolve(dbPath), { readonly: true, fileMustExist: true });
const tables = [
  'dramas', 'episodes', 'storyboards', 'characters', 'scenes', 'props',
  'character_libraries', 'scene_libraries', 'prop_libraries', 'audio_libraries',
  'ai_service_configs',
];

for (const table of tables) {
  const count = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  if (count !== 0) throw new Error(`Clean-install audit failed: ${table} contains ${count} row(s)`);
}

const sensitiveColumns = db.prepare('PRAGMA table_info(ai_service_configs)').all()
  .map(column => column.name)
  .filter(name => /key|token|secret|password/i.test(name));
for (const column of sensitiveColumns) {
  const count = db.prepare(
    `SELECT COUNT(*) AS count FROM ai_service_configs WHERE ${column} IS NOT NULL AND TRIM(CAST(${column} AS TEXT)) <> ''`
  ).get().count;
  if (count !== 0) throw new Error(`Clean-install credential audit failed: ${column} contains ${count} value(s)`);
}

db.close();
console.log('Clean-install database audit passed: all project, asset, AI configuration, and credential counts are zero.');
