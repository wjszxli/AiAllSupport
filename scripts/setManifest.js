#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Command line script to update manifest.json fields
 * Usage: node setManifest.js --name "New Name" --version "1.0.1" --description "New Description"
 */
class ManifestSetter {
    constructor() {
        this.manifestPath = path.join(__dirname, '../extension/manifest.json');
        this.args = this.parseArguments();
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const args = {};
        const argv = process.argv.slice(2);
        
        for (let i = 0; i < argv.length; i += 2) {
            const key = argv[i]?.replace(/^--/, '');
            const value = argv[i + 1];
            if (key && value) {
                args[key] = value;
            }
        }
        
        return args;
    }

    /**
     * Display usage information
     */
    showUsage() {
        console.log('Usage: node setManifest.js [options]');
        console.log('Options:');
        console.log('  --name "Extension Name"        Set the extension name');
        console.log('  --version "1.0.0"             Set the version number');
        console.log('  --description "Description"   Set the description');
        console.log('  --help                        Show this help message');
        console.log('\nExample:');
        console.log('  node setManifest.js --name "My Extension" --version "1.0.1"');
    }

    /**
     * Read and parse the current manifest file
     */
    readManifest() {
        try {
            const manifestContent = fs.readFileSync(this.manifestPath, 'utf8');
            return JSON.parse(manifestContent);
        } catch (error) {
            console.error('Error reading manifest.json:', error.message);
            process.exit(1);
        }
    }

    /**
     * Write the updated manifest back to file
     */
    writeManifest(manifest) {
        try {
            const manifestContent = JSON.stringify(manifest, null, 4);
            fs.writeFileSync(this.manifestPath, manifestContent, 'utf8');
            console.log('✅ Manifest updated successfully!');
        } catch (error) {
            console.error('Error writing manifest.json:', error.message);
            process.exit(1);
        }
    }

    /**
     * Update manifest with provided arguments
     */
    updateManifest() {
        if (this.args.help || Object.keys(this.args).length === 0) {
            this.showUsage();
            return;
        }

        const manifest = this.readManifest();
        let hasChanges = false;

        // Update fields if provided
        if (this.args.name) {
            console.log(`Updating name: "${manifest.name}" → "${this.args.name}"`);
            manifest.name = this.args.name;
            hasChanges = true;
        }

        if (this.args.version) {
            console.log(`Updating version: "${manifest.version}" → "${this.args.version}"`);
            manifest.version = this.args.version;
            hasChanges = true;
        }

        if (this.args.description) {
            console.log(`Updating description: "${manifest.description}" → "${this.args.description}"`);
            manifest.description = this.args.description;
            hasChanges = true;
        }

        if (hasChanges) {
            this.writeManifest(manifest);
        } else {
            console.log('No changes specified.');
            this.showUsage();
        }
    }
}

// Run the setter
if (require.main === module) {
    const setter = new ManifestSetter();
    setter.updateManifest();
}

module.exports = ManifestSetter;