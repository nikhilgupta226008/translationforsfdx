const { spawn } = require('child_process');
function run(process, arguments, options) {
    return new Promise((resolve, reject) => {
        var poptions=options||{};
        var alldata=[],allerr=[]
        //console.log(poptions)
        const spawnProcess = spawn(process, arguments, {
            cwd: poptions.cwd, 
            shell: true
        });

        spawnProcess.stdout.on('data', (data) => {
            //console.error(`stdout: ${data}`);
            poptions.dataHandler&&poptions.dataHandler(data);
            alldata.push(''+data);

        });

        spawnProcess.stderr.on('data', (data) => {
            //console.error(`stderr: ${data}`);
            poptions.dataHandler&&poptions.dataHandler(data);
            allerr.push(''+data);

        });


        spawnProcess.on('error', (erro) => {
            console.error(`child process exited with error:`, erro);
            poptions.errorHandler&&poptions.errorHandler(erro);
            reject(erro);
        });
        spawnProcess.on('message', (erro) => {
            console.error(`child process sent message:`, message);
            poptions.messageHandler&&poptions.messageHandler(erro);
        });

        spawnProcess.on('close', (code) => {
            //console.log(`child process exited with code ${code}`);
            resolve({data:alldata,error:allerr})
        });
    })
}
module.exports = {run}