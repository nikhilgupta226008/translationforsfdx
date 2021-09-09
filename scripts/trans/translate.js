const subprocess = require('./lib/subprocess');
const path = require('path');

const { createLogger, format, transports } = require('winston');
const Git = require('./lib/git');
const SFDX = require('./lib/sfdx');
const SalesforceTranslationExport = require('./lib/salesforceTranslationExport');
const TransaltationMetadataExtractor = require('./lib/transaltationMetadataExtractor');
const sfdxTransaltionProcessor = require('./lib/sfdxTransaltionProcessor');
const languages = require('./languages.json') ;
const config = require('./config.json') ;
const prompt = require('prompt-promise');
const {Directory} =require('./lib/dir');


(async () => {
    try {
        var conversionDir="mdapi-source/translate-package"
        var allowedLanguages = languages//.filter(v=>!v.disabled)
        // //console.log(config,languages)
        var sfdxProjectPath = path.resolve(__dirname, config.SFDXProject)
        console.log('SFDX Path |',sfdxProjectPath);
        var drive2SFDX=await (new SFDX(config.SourceOfTruthOrg,sfdxProjectPath).getOrg());
        var devSFDX=await (new SFDX(config.DevOrg,sfdxProjectPath).getOrg());
        console.log(drive2SFDX.org.accessToken);
        await drive2SFDX.clean()
        await Directory.clean(conversionDir);
        await Git.commit("SFDX CLEAN",{sfdxProjectPath})
        console.log("Cleaned SFDX Components")
        await new SalesforceTranslationExport(drive2SFDX,config).fetchTranslationExport(config.ExportIdentifier)
        console.log("Fetched Translations Export")
        await Git.commit("Fetched Translations Export",{sfdxProjectPath})
        var transaltationMetadataExtractor=new TransaltationMetadataExtractor(allowedLanguages,config,drive2SFDX,drive2SFDX)
        await transaltationMetadataExtractor.process()
        console.log("Processed Salesforce Current Translations")
        await Git.commit("Processed Salesforce Current Translations",{sfdxProjectPath})

        var components=await drive2SFDX.retrieve({packagexml:"../../manifest/package-translation.xml"})
        console.log("Retrived Components |",components.result.inboundFiles.length)
        console.log("Retrived Components warnings |",components.result.warnings)
        var sfdxconvert =  await drive2SFDX.convert({folder:conversionDir,name:"translations-package"})
        var copyToRepo =await prompt('Do you want to copy to Drive Code to Repo y/n');
        prompt.done();
        copyToRepo?"Copied to Repo and Continuing":"Just continuing" 
        await Git.commit("Retrived Components",{sfdxProjectPath})
        await sfdxTransaltionProcessor(config,allowedLanguages.map(v=>v.Language));
        await Git.commit("processsed Components",{sfdxProjectPath})

        var sfdxconvert =  await drive2SFDX.convert({folder:conversionDir,name:"translations-package"})
        console.log("Components Converted |",sfdxconvert)





    } catch (error) {
        console.error(error.stack)
    }
})();
