const JSZip = require("jszip");
const XLSX = require('xlsx')
const fetch = require('node-fetch');


class SalesforceTranslationExport{
    constructor(sfdx,config){
        this.org=sfdx.org
        this.sfdx=sfdx
        this.config=config
    }
    /**
    * Fetch Transaltation export
    *
    */
     async fetchTranslationExport(date){
        var documnetsQueryResponse=await this.sfdx.fetchData(`SELECT Id, Name, DeveloperName, ContentType, IsPublic, BodyLength, Body, Url FROM Document where Name Like 'Bilingual_${date}%'`)
        var records = await documnetsQueryResponse.json().then(response=>response.records).catch(err=>console.error(err))
        //console.log('salesforceTranslationExport | ',records)
        var retrivedZipFilesRequests = []
        try {
            for (var record of records) {
                retrivedZipFilesRequests.push(this.fetchAndUnzip(record))
            }
            this.retrivedZipFiles = (await Promise.all(retrivedZipFilesRequests)).map(v => v[0])
            this.trasnlationsJson = await this.createJSON(this.retrivedZipFiles);
            this.trasnlationsJsonByLabel = await this.createJsonByLabel(this.retrivedZipFiles);
            this.sheet = await this.createSheet(this.trasnlationsJson,date)
            //console.log('salesforceTranslationExport | ',this.sheet)
        } catch (e) {
            console.error(e);
        }

    }

    async createJSON(retrivedZipFiles) {
        var trasnlationsJson = {}
        retrivedZipFiles.forEach(function (file) {
            var languageKey = file.content.split('\n')
                .find(v => v.indexOf('Language code:') == 0).split(':')[1].trim();

            file.content
                //.split('------------------OUTDATED AND UNTRANSLATED-----------------')[0]
                .split('\n')
                .filter(v => v && v.indexOf('#') != 0 && v.indexOf('Language code:') != 0 && v.indexOf('Type:') != 0 && v.indexOf('Translation type:') != 0 && v.indexOf('------------------TRANSLATED-------------------') != 0 && v.indexOf('------------------OUTDATED AND UNTRANSLATED-----------------') != 0)
                .forEach(v => {
                    var transinfo = v.split('\t')
                    trasnlationsJson[transinfo[0]] = trasnlationsJson[transinfo[0]] || {};
                    trasnlationsJson[transinfo[0]][languageKey] = trasnlationsJson[transinfo[0]][languageKey] || {};
                    trasnlationsJson[transinfo[0]][languageKey] = transinfo[2]
                    trasnlationsJson[transinfo[0]]['Metdata'] = transinfo[0]
                    trasnlationsJson[transinfo[0]]['Label'] = transinfo[1]
                })
        })
        //console.log('salesforceTranslationExport | ','trasnlationsJson', Object.keys(trasnlationsJson).length)
        return trasnlationsJson
    }

    async createJsonByLabel(retrivedZipFiles) {
        var trasnlationsJson = {}
        retrivedZipFiles.forEach(function (file) {
            console.log('salesforceTranslationExport | ','Processing | ',file.name)
            var languageKey = file.content.split('\n')
                .find(v => v.indexOf('Language code:') == 0).split(':')[1].trim();

            file.content
                //.split('------------------OUTDATED AND UNTRANSLATED-----------------')[0]
                .split('\n')
                .filter(v => v && v.indexOf('#') != 0 && v.indexOf('Language code:') != 0 && v.indexOf('Type:') != 0 && v.indexOf('Translation type:') != 0 && v.indexOf('------------------TRANSLATED-------------------') != 0 && v.indexOf('------------------OUTDATED AND UNTRANSLATED-----------------') != 0)
                .forEach(v => {
                    var transinfo = v.split('\t')
                    var metadata = transinfo[0], label = transinfo[1].trim().toLowerCase(), notProcessedLabel = transinfo[1];
                    var metadataParent = (['LayoutSection', 'LookupFilter', 'ButtonOrLink', 'CustomField'].indexOf(metadata.split('.')[0]) >= 0) ? metadata.split('.')[1] : metadata.split('.')[0];//temp.push({metadata,metadataParent,label});
                    trasnlationsJson[label] = trasnlationsJson[label] || {};
                    trasnlationsJson[label][languageKey] = trasnlationsJson[label][languageKey] || {};
                    trasnlationsJson[label][languageKey] = transinfo[2];
                    trasnlationsJson[label]['Metadata(s)'] = (trasnlationsJson[label]['Metadata(s)'] ? [...trasnlationsJson[label]['Metadata(s)'], ...[metadata]] : [metadata]);
                    trasnlationsJson[label]['MetadataParent(s)'] = (trasnlationsJson[label]['MetadataParent(s)'] ? [...trasnlationsJson[label]['MetadataParent(s)'], ...[metadataParent]] : [metadataParent]);
                    trasnlationsJson[label]['#Unique Label'] = label;
                    trasnlationsJson[label]['Label(s)'] = (trasnlationsJson[label]['Label(s)'] ? [...trasnlationsJson[label]['Label(s)'], ...[notProcessedLabel]] : [notProcessedLabel]);
                })
        })
    }

    async fetchAndUnzip(record) {
        const url = this.org.instanceUrl + record.Body;
        //console.log('salesforceTranslationExport | ','SFDX | ',url,this.org.accessToken)
        var fileResponse = await fetch(url, {
            headers: {
                'authorization': 'OAuth '+this.org.accessToken,
            }
        });
        var arrayBuffer = await fileResponse.arrayBuffer()
        //console.log('salesforceTranslationExport | ',arrayBuffer)
        var zipfolder = await JSZip.loadAsync(arrayBuffer)

        var retrivedZipFiles = []

        for (var fileLink of Object.keys(zipfolder.files)) {
            retrivedZipFiles.push({
                name: zipfolder.files[fileLink].name,
                path: fileLink,
                content: await zipfolder.files[fileLink].async("string")
            })
        }
        console.log('salesforceTranslationExport | ',retrivedZipFiles.length)
        return retrivedZipFiles
    }

    async createSheet(trasnlationsJson,date) {
        var data = [];
        for (var key in trasnlationsJson) {
            data.push(trasnlationsJson[key])
        }
        console.log('salesforceTranslationExport | ','createSheet', data.length)

        /* make the worksheet */
        var ws = XLSX.utils.json_to_sheet(data);

        /* add to workbook */
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Drive2 Current Transaltions");

        /* generate an XLSX file */
        return XLSX.writeFile(wb, this.config.currentTransaltionsFile);

    }
}

module.exports = SalesforceTranslationExport