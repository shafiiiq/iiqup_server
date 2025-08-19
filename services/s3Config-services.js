const { getObjectUrl } = require('../s3bucket/s3.bucket');

module.exports = {
    fetchPresignedURL: (s3key, isLong, isAuthSign = false) => {

        return new Promise(async (resolve, reject) => {
            try {
                const dataURL = await getObjectUrl(s3key, isLong, isAuthSign);
                resolve({
                    status: 200,
                    ok: true,
                    dataUrl: dataURL
                    // dataUrl: "https://wallpapercave.com/wp/wp4088642.jpg"
                });
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: error.message || 'Error fetching users'
                });
            }
        });
    },
}