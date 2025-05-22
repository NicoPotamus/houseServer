import { execSync } from 'child_process';
// Add console statements to each function for debugging
console.log('dockerController functions loaded');
// Create a Docker volume for a user
export const createUserVolume = (userId) => {
    const volumeName = `user_${userId}`;
    try {
        execSync(`docker volume create ${volumeName}`);
        console.log(`Volume created for user: ${userId}`);
    }
    catch (error) {
        console.error(`Error creating volume for user ${userId}:`, error);
    }
};
// Get the storage usage of a user's volume
export const getUserStorageUsage = (userId) => {
    const volumeName = `user_${userId}`;
    try {
        const output = execSync(`docker run --rm -v ${volumeName}:/data alpine du -sb /data`).toString();
        const usage = parseInt(output.split('\t')[0], 10);
        console.log(`Storage usage for user ${userId}: ${usage} bytes`);
        return usage;
    }
    catch (error) {
        console.error(`Error getting storage usage for user ${userId}:`, error);
        return 0;
    }
};
// Enforce user quota before allowing file uploads
export const enforceUserQuota = (userId, fileSize, userQuota) => {
    const currentUsage = getUserStorageUsage(userId);
    if (currentUsage + fileSize > userQuota) {
        console.error(`User ${userId} exceeded their quota. Current usage: ${currentUsage}, File size: ${fileSize}, Quota: ${userQuota}`);
        return false;
    }
    return true;
};
