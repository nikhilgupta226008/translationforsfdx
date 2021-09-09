const NodeGit = require("nodegit");
const winston = require('winston');
/*https://gist.github.com/getify/f5b111381413f9d9f4b2571c7d5822ce*/
class Git{
    static async commit(commitMessage, options) {
        
    
        let pathToRepo=options.pathToRepo||"../../"
        
        var repo = await NodeGit.Repository.open(pathToRepo).catch(async error => await NodeGit.Repository.init(pathToRepo, 0))
        //console.log("GIT",(await repo.getCurrentBranch()).shorthand())
        const index = await repo.refreshIndex();
        await index.addAll();
        await index.write();
        const oid = await index.writeTree();
    
        //console.log("GIT","Default Signature", await NodeGit.Signature.default(repo));
    
        const author = options.user? await NodeGit.Signature.now(options.user.name,options.user.email):await NodeGit.Signature.default(repo);
        const committer = options.user?await NodeGit.Signature.now(options.user.name,options.user.email):await NodeGit.Signature.default(repo);
    
        //console.log("GIT","Authur", author);
    
        const parent = await repo.getHeadCommit();
        const commitId = await repo.createCommit("HEAD", author, committer, commitMessage , oid, [parent]);
        //console.log("GIT","New Commit: ", commitId);
    
    }


}
module.exports = Git
