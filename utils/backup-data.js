const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const os = require('os');

const backupData = async () => {
    const databaseName = 'iiqup';
    
    // Full absolute path - easy to change to external drive later
    const backupPath = '/aws/server/backup/database';
                       
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://username:password@cluster.mongodb.net/';
        
    const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
    
    const backupName = `backup_${databaseName}_${timestamp}`;
    const backupFullPath = path.join(backupPath, backupName);

    let client;

    try {
        console.log('🚀 Starting backup process...');
        console.log(`📁 Backup path: ${backupFullPath}`);

        // Check if backup directory exists and create if not
        if (!fs.existsSync(backupPath)) {
            console.log('📁 Creating backup directory...');
            fs.mkdirSync(backupPath, { recursive: true });
            console.log('✅ Backup directory created');
        }

        if (!fs.existsSync(backupFullPath)) {
            console.log('📁 Creating backup folder...');
            fs.mkdirSync(backupFullPath, { recursive: true });
            console.log('✅ Backup folder created');
        }

        // Test write permission
        const testFile = path.join(backupFullPath, 'test.txt');
        try {
            fs.writeFileSync(testFile, 'test', 'utf8');
            fs.unlinkSync(testFile); // Delete test file
            console.log('✅ Write permissions verified');
        } catch (permError) {
            console.error('❌ No write permission:', permError.message);
            throw new Error(`No write permission to ${backupFullPath}`);
        }

        console.log('🔗 Connecting to MongoDB...');
        client = new MongoClient(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 30000,
        });
        
        await client.connect();
        console.log('✅ Connected to MongoDB Atlas successfully');

        const db = client.db(databaseName);
        console.log('📦 Getting list of collections...');
        const collections = await db.listCollections().toArray();
        console.log(`📋 Found ${collections.length} collections to backup`);

        for (let i = 0; i < collections.length; i++) {
            const collectionInfo = collections[i];
            const collectionName = collectionInfo.name;
            
            console.log(`📋 [${i + 1}/${collections.length}] Backing up collection: ${collectionName}`);
            
            try {
                const collection = db.collection(collectionName);
                const count = await collection.countDocuments();
                console.log(`📊 Collection ${collectionName} has ${count} documents`);
                
                let documents;
                if (count === 0) {
                    console.log(`⚠️  Collection ${collectionName} is empty, creating empty backup file`);
                    documents = [];
                } else if (count > 10000) {
                    console.log(`📦 Large collection detected, using cursor for ${collectionName}`);
                    documents = [];
                    const cursor = collection.find({});
                    await cursor.forEach(doc => {
                        documents.push(doc);
                    });
                } else {
                    documents = await collection.find({}).toArray();
                }
                
                const filePath = path.join(backupFullPath, `${collectionName}.json`);
                console.log(`💾 Writing to file: ${filePath}`);
                
                const jsonData = JSON.stringify(documents, null, 2);
                fs.writeFileSync(filePath, jsonData, 'utf8');
                
                // Verify file was created and get size
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    const sizeKB = (stats.size / 1024).toFixed(2);
                    console.log(`✅ ${collectionName}: ${count} documents backed up (${sizeKB} KB)`);
                } else {
                    console.error(`❌ Failed to create backup file for ${collectionName}`);
                }
                
            } catch (collectionError) {
                console.error(`❌ Error backing up collection ${collectionName}:`, collectionError.message);
                // Continue with next collection instead of silent failure
            }
        }

        // Clean old backups - keep only latest 10 folders
        console.log('🧹 Cleaning old backups...');
        cleanOldBackups(backupPath);

        console.log(`✅ Backup completed successfully: ${backupName}`);
        console.log(`📁 Backup location: ${backupFullPath}`);

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        if (client) {
            try {
                await client.close();
                console.log('🔒 MongoDB connection closed');
            } catch (closeError) {
                console.error('❌ Error closing connection:', closeError.message);
            }
        }
    }
};

const cleanOldBackups = (backupPath) => {
    try {
        if (!fs.existsSync(backupPath)) {
            console.log('⚠️  Backup path does not exist, skipping cleanup');
            return;
        }

        // Get all backup folders
        const items = fs.readdirSync(backupPath);
        const backupFolders = items.filter(item => {
            const itemPath = path.join(backupPath, item);
            return fs.statSync(itemPath).isDirectory() && item.startsWith('backup_');
        });

        console.log(`🗂️  Found ${backupFolders.length} backup folders`);

        // Sort by creation time (newest first)
        backupFolders.sort((a, b) => {
            const aPath = path.join(backupPath, a);
            const bPath = path.join(backupPath, b);
            const aStat = fs.statSync(aPath);
            const bStat = fs.statSync(bPath);
            return bStat.mtime.getTime() - aStat.mtime.getTime();
        });

        // Keep only latest 10 folders, delete the rest
        if (backupFolders.length > 10) {
            const foldersToDelete = backupFolders.slice(10);
            console.log(`🗑️  Deleting ${foldersToDelete.length} old backup folders`);
            
            foldersToDelete.forEach(folder => {
                const folderPath = path.join(backupPath, folder);
                try {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                    console.log(`🗑️  Deleted: ${folder}`);
                } catch (deleteError) {
                    console.error(`❌ Failed to delete ${folder}:`, deleteError.message);
                }
            });
        } else {
            console.log('✅ No old backups to clean');
        }
    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
    }
};

const autoBackup = () => {
    console.log('🚀 Auto-backup system started - Every hour');
    
    // Run initial backup to test
    console.log('🧪 Running initial backup test...');
    backupData();
    
    // Schedule hourly backup
    cron.schedule('0 * * * *', async () => {
        console.log('⏰ Scheduled backup starting...');
        await backupData();
    }, {
        scheduled: true,
        timezone: "UTC"
    });

    // Return middleware function
    return (req, res, next) => {
        next();
    };
};

module.exports = { autoBackup };