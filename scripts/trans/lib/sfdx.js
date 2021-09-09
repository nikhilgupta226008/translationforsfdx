const subprocess = require('./subprocess');
const core_1 = require("@salesforce/core");
const path = require('path');
const fs = require('fs');
const Builder = require('fast-xml-parser').j2xParser;

const fetch = require('node-fetch');

class SFDX {
    org;
    instanceUrl;
    directory;
    constructor(instanceUrl, directory) {
        this.instanceUrl = instanceUrl;
        this.directory = directory
    }

    /**
    * Clean the sfdx default folder
    *
    */
    async clean() {
        try {
            if (fs.existsSync(this.directory + '/sfdx-project.json')) {

                var directoryPath = this.directory + '/force-app/main/default'
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

    /**
    * Get the org information from SFDX CLI api
    *
    */
    async getOrg() {       
        var sfdxorgs=await subprocess.run('sfdx', ['force:org:list', '--json']) //kept to refresh token
        ///var orgs = JSON.parse(sfdxorgs.data)//As access token is encrypted can't be used but 
        var orgs = await core_1.AuthInfo.listAllAuthorizations()
        this.org = orgs.find(nso => nso.instanceUrl == this.instanceUrl)
        if(!this.org){
            throw new Error("Seems you have not authorized to "+ this.instanceUrl)
        }
        return this;
    }

    /**
    * Fetch DATA using DATA api
    * @param query SOQL query to retrive data
    */
    async fetchData(query,options){
        const url = this.org.instanceUrl+"/services/data/v52.0/query?q="+encodeURIComponent(query);
        //console.log('SFDX | ',url,this.org.accessToken)
        if(options && options.json){
            return await fetch(url, {
                headers: {
                    'authorization': 'OAuth '+this.org.accessToken,
                }
            }).then(response=>response.json()).then(response=>response.records);
        }
        return await fetch(url, {
            headers: {
                'authorization': 'OAuth '+this.org.accessToken,
            }
        });
    }
    /**
    * Fetch DATA using Tooling DATA api
    * @param query SOQL query to retrive data
    */
    async fetchToolingData(query,options){
        const url = this.org.instanceUrl+"/services/data/v52.0/tooling/query?q="+encodeURIComponent(query);
        //console.log('SFDX | ',url,this.org.accessToken)
        if(options && options.json){
            return await fetch(url, {
                headers: {
                    'authorization': 'OAuth '+this.org.accessToken,
                }
            }).then(response=>response.json()).then(response=>(response)).then(response=>response.records).catch(err=>console.error(err));
        }
        return await fetch(url, {
            headers: {
                'authorization': 'OAuth '+this.org.accessToken,
            }
        }).catch(err=>console.error(err));
    }

    async retrieve(options){
        var sfdxretrive=await subprocess.run('sfdx', ['force:source:retrieve', '--json -x "'+options.packagexml+'"','-u '+this.org.username]) //kept to refresh token
        if(sfdxretrive.error.length>0){
            console.error(sfdxretrive.error)
        }
        return JSON.parse(sfdxretrive.data)
    }

    async convert(options){
        var sfdxconvert = await subprocess.run('sfdx', ['force:source:convert', '-n "'+options.name+'"  -d "'+options.folder+'"'],{cwd:'../../'}) //kept to refresh token
        if(sfdxconvert.error.length>0){
            console.error(sfdxconvert)
        }
        return sfdxconvert.data
    }

    async getPackageXml(types){
        const builder = new Builder({
            format: true,
            attrNodeName: '$'
        });
        const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
        var packageManifestJson ={
            Package:{
                $:{xmlns: 'http://soap.sforce.com/2006/04/metadata'},
                types:types,
                version:'49.0'
            }
            
        }
        const xml = xmlDeclaration.concat(builder.parse(packageManifestJson)).trim();
        return xml;
    }
}
module.exports = SFDX