#!/usr/bin/env node
/**
 * Test Isolation Verification Script
 * 
 * This script verifies that test files are properly isolated and don't share state.
 * It checks for:
 * - No shared global state between tests
 * - Proper cleanup in afterAll/afterEach hooks
 * - No hardcoded paths that could cause conflicts
 * - No shared database instances or file handles
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestFile {
  path: string;
  content: string;
  issues: string[];
}

function checkTestIsolation(testDir: string): TestFile[] {
  const testFiles: TestFile[] = [];
  const testPattern = /\.test\.ts$/;

  function scanDirectory(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (testPattern.test(file)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const issues = analyzeTestFile(content, fullPath);
        testFiles.push({ path: fullPath, content, issues });
      }
    }
  }

  scanDirectory(testDir);
  return testFiles;
}

function analyzeTestFile(content: string, filePath: string): string[] {
  const issues: string[] = [];
  const lines = content.split('\n');

  // Check for global variables outside test blocks
  let inDescribeBlock = false;
  let hasAfterAll = false;
  let hasAfterEach = false;
  let hasBeforeAll = false;
  let hasBeforeEach = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('describe(')) {
      inDescribeBlock = true;
    }

    if (line.includes('afterAll(')) hasAfterAll = true;
    if (line.includes('afterEach(')) hasAfterEach = true;
    if (line.includes('beforeAll(')) hasBeforeAll = true;
    if (line.includes('beforeEach(')) hasBeforeEach = true;

    // Check for hardcoded paths that could cause conflicts
    if (line.includes('/tmp/') || line.includes('./tmp/')) {
      if (!line.includes('uuid') && !line.includes('random')) {
        issues.push(`Line ${i + 1}: Hardcoded temporary path without unique identifier`);
      }
    }

    // Check for shared database connections
    if (line.includes('global.') || line.includes('globalThis.')) {
      issues.push(`Line ${i + 1}: Global variable usage detected - may cause state leakage`);
    }

    // Check for singleton patterns without cleanup
    if (line.includes('getInstance') || line.includes('instance')) {
      if (!hasAfterAll && !hasAfterEach) {
        issues.push(`Line ${i + 1}: Singleton pattern detected without cleanup hooks`);
      }
    }
  }

  // If the test creates resources, it should have cleanup
  if (content.includes('new ') && !hasAfterAll && !hasAfterEach) {
    const resourcePatterns = [
      /new.*Pool\(/,
      /new.*Connection\(/,
      /new.*Client\(/,
      /new.*Manager\(/,
    ];
    for (const pattern of resourcePatterns) {
      if (pattern.test(content)) {
        issues.push('Test creates resources without cleanup hooks (afterAll/afterEach)');
        break;
      }
    }
  }

  return issues;
}

function main() {
  const testDir = path.join(__dirname, '..', 'test');
  const testFiles = checkTestIsolation(testDir);

  let totalIssues = 0;
  const filesWithIssues: string[] = [];

  console.log('Test Isolation Verification Results');
  console.log('=====================================\n');

  for (const testFile of testFiles) {
    if (testFile.issues.length > 0) {
      filesWithIssues.push(testFile.path);
      console.log(`\n${path.relative(process.cwd(), testFile.path)}:`);
      for (const issue of testFile.issues) {
        console.log(`  - ${issue}`);
        totalIssues++;
      }
    }
  }

  console.log(`\n====================================`);
  console.log(`Total files checked: ${testFiles.length}`);
  console.log(`Files with issues: ${filesWithIssues.length}`);
  console.log(`Total issues: ${totalIssues}`);

  if (totalIssues > 0) {
    console.log('\n❌ Test isolation verification failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests are properly isolated');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { checkTestIsolation, analyzeTestFile };
