const fs = require('fs');
class Directory{
    static async clean(directoryPath){
        try {
            if (fs.existsSync(directoryPath)) {

                fs.readdirSync(directoryPath).forEach((file, index) => {
                    const curPath = path.join(directoryPath, file);
                    if (fs.lstatSync(curPath).isDirectory()) {
                        // recurse
                        fs.rmdirSync(curPath, { recursive: true });

                    } else {
                        // delete file
                        fs.unlinkSync(curPath);
                    }
                });
            }
        } catch (err) {
            console.error(err)
        }
    }
}
module.exports = {Directory}