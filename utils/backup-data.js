const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');

const backupData = async () => {
    const databaseName = 'iiqup';
    const backupPath = 'C:\\iiQup\\database';
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://username:password@cluster.mongodb.net/';
        
    const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
    
    const backupName = `backup_${databaseName}_${timestamp}`;
    const backupFullPath = path.join(backupPath, backupName);

    let client;

    try {
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        if (!fs.existsSync(backupFullPath)) {
            fs.mkdirSync(backupFullPath, { recursive: true });
        }

        client = new MongoClient(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 30000,
        });
        
        await client.connect();

        const db = client.db(databaseName);
        const collections = await db.listCollections().toArray();

        for (let i = 0; i < collections.length; i++) {
            const collectionInfo = collections[i];
            const collectionName = collectionInfo.name;
            
            try {
                const collection = db.collection(collectionName);
                const count = await collection.countDocuments();
                
                let documents;
                if (count > 10000) {
                    documents = [];
                    const cursor = collection.find({});
                    await cursor.forEach(doc => {
                        documents.push(doc);
                    });
                } else {
                    documents = await collection.find({}).toArray();
                }
                
                const filePath = path.join(backupFullPath, `${collectionName}.json`);
                fs.writeFileSync(filePath, JSON.stringify(documents, null, 2), 'utf8');
                
            } catch (collectionError) {
                // Silent error handling - just skip failed collections
            }
        }

        // Clean old backups - keep only latest 10 folders
        cleanOldBackups(backupPath);

        console.log(`✅ Backup completed: ${backupName}`);

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
    } finally {
        if (client) {
            try {
                await client.close();
            } catch (closeError) {
                // Silent error handling
            }
        }
    }
};

const cleanOldBackups = (backupPath) => {
    try {
        if (!fs.existsSync(backupPath)) {
            return;
        }

        // Get all backup folders
        const items = fs.readdirSync(backupPath);
        const backupFolders = items.filter(item => {
            const itemPath = path.join(backupPath, item);
            return fs.statSync(itemPath).isDirectory() && item.startsWith('backup_');
        });

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
            foldersToDelete.forEach(folder => {
                const folderPath = path.join(backupPath, folder);
                try {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                } catch (deleteError) {
                    // Silent error handling
                }
            });
        }
    } catch (error) {
        // Silent error handling
    }
};

const autoBackup = () => {
    console.log('🚀 Auto-backup system started - Every hour');
    
    // Schedule hourly backup
    cron.schedule('0 * * * *', async () => {
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