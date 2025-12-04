#!/usr/bin/env node

// Check if current directory exists before running CLI
try {
  process.cwd();
} catch (error) {
  console.error('');
  console.error('\x1b[31m Error: Current directory no longer exists.\x1b[0m');
  console.error('');
  console.error('This usually happens when:');
  console.error('  - The directory was deleted or renamed');
  console.error('  - You are in a temporary directory that was cleaned up');
  console.error('');
  console.error('Next steps:');
  console.error('  1. cd ~                  # Go to home directory');
  console.error('  2. cd /path/to/project   # Navigate to your project');
  console.error('  3. sidstack <command>    # Run the command again');
  console.error('');
  process.exit(1);
}

const oclif = require('@oclif/core');

oclif.execute({ dir: __dirname });
