var XLSX = require('xlsx');
var fs = require('fs');
var decode = require('decode-html');
var encode = require('encode-html');
const { exception } = require('console');

class TransaltationMetadataExtractor {
    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    newItems = [];
    sames = {};
    multiple = [];
    package = [];
    languageCodes = [];
    translatedLanguges = new Set();
    packageParents=[];
    constructor(languages, config, sourceSfdx, destSfdx) {
        this.config = config
        this.languages = languages
        this.masterWorkBook = XLSX.readFile(config.currentTransaltionsFile);
        this.allowedMetdata = config.allowedMetdata.map(v => v.name);
        this.sourceSfdx = sourceSfdx
        this.destSfdx = destSfdx
        this.translatedLabels = []
    }

    async process() {
        await this.processSalesforceTranslationSheet()
        this.processTransaltionRequestSheets()
        this.generateTranslationProvided()
        await this.generatePackageXMl()
        this.createValidationsSheet()
        this.creatCSV(this.uniqueNewItems, this.config.TranslationValidations + '/TranslationAllUnique.csv')
        this.creatCSV(this.newItems, this.config.TranslationValidations + '/TranslationAll.csv')
        this.creatCSV([...this.translatedLanguges], this.config.TranslationValidations + '/TranslationLanguages.csv')

        //Extracting Not Translated Labels
        if (this.packageTyeps.find(v => v.name == 'CustomLabel')) {
            var cecLabels = this.salesforceCurrentTranslations
                .filter(v => v.Metdata.split('.')[0] == 'CustomLabel' && v.Metdata.split('.')[1].toLowerCase().indexOf('cec') == 0)
                .map(v => {
                    v["Translated"] = this.packageTyeps.find(v => v.name == 'CustomLabel').members.indexOf(v.Metdata.split('.')[1]) >= 0 ? "Transalted" : "Will be Transalted"
                    v["Configuration"] = "No"
                    return v
                })
            this.creatCSV(cecLabels, this.config.TranslationValidations + '/Labels.csv')
        }
        return { languages: [...this.translatedLanguges] }
    }
    matchesInclude(include, exclude, term, termInfo) {
        var isExclude = exclude.reduce((excludeTillNow, excludeRegex) => {
            if (typeof excludeRegex == "string") {

                return excludeTillNow || term.match(new RegExp("^" + excludeRegex + "$"))
            } else {
                return excludeTillNow || Object.keys(excludeRegex).reduce((excludeRegexKeyMatchTillNow, excludeRegexKey) => {
                    //console.log("TME",term,excludeRegexKey)
                    return excludeRegexKeyMatchTillNow || (termInfo && (termInfo[excludeRegexKey] || "").match(new RegExp("^" + excludeRegex[excludeRegexKey] + "$")))
                }, false)
            }
        }, false)

        var isInclude = include.reduce((allowedTillNow, includeRegex) => {
            return allowedTillNow || term.match(new RegExp("^" + includeRegex + "$", "i"))
        }, false)

        return !isExclude && isInclude

    }
    async processSalesforceTranslationSheet() {
        //var allowedMetdataParents = "CEC_Alert_Message__c,CEC_User_Out_of_Office__c,Account,Activity,Case,Contact,EmailMessage,User,CEC_Queue_Group_Permissionset_Lookup__c,CEC_BatchJob_Settings__c,CEC_EFM__c,CEC_Email_to_Case_Routing_Table__c,CEC_Queue_To_SLA_Mapping__c,CEC_Web_to_Case_Routing_Table__c,CEC_Country_And_Language_Mapping__c,CEC_Duplicate_Contact_Email__c,CEC_ProfileSetup__c,CEC_Threshold_APILimit__c,CEC_CustomPermissionAndGroupAssignment__c,CEC_KnowledgeGBSTowerAndGroupMapping__c,CEC_Deleted_Attachment_Info__c,CEC_BU_SLIC_Destination_Fields_Mapping__c,CEC_SLIC_Queue_Management__c,CEC_AR_Routable_Country__c,CEC_Alert_Message_Junction__c,CEC_Case_Alert_Notification_Time__c,CEC_Case_Routing__c,CEC_Country_Mapping__c,CEC_Escalation_Hierarchy__c,CEC_Exceptional_Country__c,CEC_Object_InsertUpdateDelete_Matrix__c,CEC_Origin_to_Category_Mapping__c,CEC_Phone_Data_Mapping__c,CEC_Phone_Reason_Code_Mapping__c,CEC_ShipmentIdentifierType__c,CEC_ShippingIdentifier__c,CEC_Skill_Group__c,CEC_User_AR_Case_Reassign__c,CEC_User_Skill_Group__c,IVR_Data__c,I_Want_To_Option_Mapping__c,VA_Transcript__c,CEC_Purge_Input__c,CEC_Purged_Case__c,CEC_Country_Context_Mapping__c,CEC_Data_Integration__c,AgentWork".split(',')
        //this.allowedMetdataParents = "PersonAccount,CEC_ShipmentIdentifierType__c,CEC_User_Out_of_Office__c,Account,Activity,Case,Contact,EmailMessage,User,CEC_Alert_Message_Junction__c,CEC_ShippingIdentifier__c,CEC_Skill_Group__c,CEC_User_Skill_Group__c,IVR_Data__c,VA_Transcript__c".split(',')
        this.allowedMetdataParents = this.config.allowedMetdata.find(v => v.name == "CustomField").include.sObjects.map(v => v == "CEC_ShipmentIdentifierType__mdt" ? "CEC_ShipmentIdentifierType__c" : v)

        //var allowedQuickActions = "Account.Case,Account.Contact,Account.CEC_Event,Account.CEC_Task,Account.create_a_case,Case.CEC_Event,Case.CEC_Task,Case.Child_Case,Case.Close_Case_Feed,Case.Log_a_Call,Case.New_Child_Case,Case.Close_Support_Case,Case.Update_CEC_Case,Contact.Case,Contact.CEC_Event,Contact.CEC_Task,Contact.Update_CEC_Contact,CEC_CreateContact,New_CEC_Contact,Submit_Feedback".split(',');
        var allowedQuickActions = this.config.allowedMetdata.find(v => v.name == "QuickAction").include

        //var allowedStandardValueSet = "Standard.caseStatus,Standard.casePriority,Standard.caseOrigin,Standard.caseReason,Standard.taskStatus,Standard.taskType,Standard.statusReason,Standard.eventSubject,Standard.taskPriority,Standard.taskSubject".split(',');
        //var allowedStandardValueSet = "Standard.caseStatus,Standard.casePriority,Standard.taskStatus,Standard.taskType,Standard.taskPriority".split(',');
        var allowedStandardValueSet = this.config.allowedMetdata.find(v => v.name == "PicklistValue").include.StandardValueSet.map(v => 'standard.' + v.toLowerCase())
        var allowedGlobalValueSet = this.config.processTransaltionRequestPicklistExcels ? this.config.allowedMetdata.find(v => v.name == "PicklistValue").include.GlobalValueSet.map(v => v.toLowerCase() + '__e') : []

        //var allowedLayouts = "PersonAccount.CEC Person Account Layout,Account.CEC Account Layout,Contact.CEC Contact Layout,User.User Layout,CEC_Alert_Message__c.CEC Account Alert Message Layout,CEC_Alert_Message__c.CEC Alert Message Layout,CEC_Alert_Message__c.CEC General Alert Message Layout,CEC_Alert_Message__c.CEC Geography Alert Message Layout,CEC_Alert_Message__c.CEC Industry Alert Message Layout,CEC_EFM__c.CEC EFM Layout,CEC_Email_to_Case_Routing_Table__c.CEC Email to Case Routing Table Layout,CEC_Queue_To_SLA_Mapping__c.CEC Queue To SLA Mapping Layout,CEC_Web_to_Case_Routing_Table__c.CEC Web to Case Routing Table Layout,CEC_User_Out_of_Office__c.CEC User Out of Office Layout,CEC_ProfileSetup__c.CEC Profile Setup Layout,CEC_CustomPermissionAndGroupAssignment__c.Custom Permission and Group Assignment Layout,CEC_BU_SLIC_Destination_Fields_Mapping__c.CEC BU SLIC Destination Fields Mapping Layout,CEC_SLIC_Queue_Management__c.CEC SLIC Queue Management Layout,CEC_Case_Alert_Notification_Time__c.Case Alert Notification Time Layout,CEC_Case_Routing__c.CEC Case Routing Layout,CEC_Country_Mapping__c.CEC Country Mapping Layout,CEC_Escalation_Hierarchy__c.Escalation Hierarchy Layout,CEC_Object_InsertUpdateDelete_Matrix__c.Object Update Matrix Layout,CEC_Origin_to_Category_Mapping__c.Origin to Category Mapping Layout,CEC_Origin_to_Category_Mapping__c.Origin to Reason Mapping Layout,CEC_ShipmentIdentifierType__c.CEC Shipment Identifier Layout,CEC_ShippingIdentifier__c.Shipment Identifier Layout,CEC_Skill_Group__c.CEC Skill Group Layout,CEC_User_Skill_Group__c.CEC User Skill Group Layout,IVR_Data__c.IVR Data Layout,I_Want_To_Option_Mapping__c.Field to Picklist Option Mapping Layout,VA_Transcript__c.VA Transcript Layout,CEC_Purge_Input__c.CEC Purge Input Layout,CEC_Purged_Case__c.CEC Purged Case Layout,Case.CEC Admin AR Case Layout,Case.CEC Admin Case Layout,Case.CEC CCR AR Case Layout,Case.CEC CCR Case Layout,Case.CEC Case Layout - Supervisor,Case.CEC Case Layout,Case.CEC FSG after submission layout,Case.CEC MYB Case Layout,Case.CEC Manager AR Case Layout,Case.CEC Manager Case Layout,Case.CEC Specialized AR Case Layout,Case.CEC Specialized Case Layout,Case.CEC Support Case Layout,Case.SRC Case Layout".split(',');
        var allowedLayouts = this.config.allowedMetdata.find(v => v.name == "LayoutSection").include

        //var labelexceptions = "Case_Categorization_Country_Error,Coporate_Concern_Confirm_Msg,Increment_Priority_Confirm_Msg".split(',');
        var allowedCustomLabels = this.config.allowedMetdata.find(v => v.name == "CustomLabel").include
        var excludedCustomLabels = this.config.allowedMetdata.find(v => v.name == "CustomLabel").exclude
        this.customLabels = await this.sourceSfdx.fetchToolingData('Select Category,Name from ExternalString', { json: true })
        this.customLabelInfoMap = this.customLabels.reduce((lableMap, label) => { return lableMap[label.Name] = label, lableMap }, {})

        this.salesforceCurrentTranslations = XLSX.utils.sheet_to_json(this.masterWorkBook.Sheets[this.masterWorkBook.SheetNames[0]]);

        this.salesforceCurrentTranslationsFiltered = []
        this.sfctMetadata = this.salesforceCurrentTranslations.filter(v => this.allowedMetdata.indexOf(v.Metdata.split('.')[0]) >= 0)
        this.sfctMetadataMap = this.sfctMetadata.reduce((a, v) => {

            var s = v.Metdata.split('.').map(v => v.trim())
            var metadataName = s[0]
            if (metadataName == 'PicklistValue' && s[1] == 'Standard' && this.matchesInclude(allowedStandardValueSet, [], (s[1] + '.' + s[2]))) {
                metadataName = 'StandardValueSet'
                a[metadataName] = a[metadataName] || {}
                a[metadataName]['name'] = metadataName;
                a[metadataName]['parent'] = Array.from(new Set([...(a[metadataName]['parent'] || []), s[1]]));
                a[metadataName]['members'] = Array.from(new Set([...(a[metadataName]['members'] || []), s[2] ? s[1] + '.' + s[2] : s[1]]));
                a[metadataName]['name'] = 'StandardValueSet'
                v['package'] = 'StandardValueSet$' + this.capitalizeFirstLetter(s[2])
                this.salesforceCurrentTranslationsFiltered.push(v)
            }
            else if (metadataName == 'PicklistValue' && this.matchesInclude(allowedGlobalValueSet, [], s[1])) {
                metadataName = 'GlobalValueSet'
                a[metadataName] = a[metadataName] || {}
                a[metadataName]['name'] = metadataName;
                a[metadataName]['parent'] = Array.from(new Set([...(a[metadataName]['parent'] || []), s[1]]));
                a[metadataName]['members'] = Array.from(new Set([...(a[metadataName]['members'] || []), s[1]]));
                a[metadataName]['name'] = 'GlobalValueSet'
                v['package'] = 'GlobalValueSet$' + s[1]
                this.salesforceCurrentTranslationsFiltered.push(v)
            }
            else if (metadataName == 'LayoutSection' && this.matchesInclude(allowedLayouts, [], s[1] + '.' + s[2])) {
                metadataName = 'LayoutSection'
                a[metadataName] = a[metadataName] || {}
                a[metadataName]['name'] = metadataName;
                a[metadataName]['parent'] = Array.from(new Set([...(a[metadataName]['parent'] || []), s[1]]));
                a[metadataName]['members'] = Array.from(new Set([...(a[metadataName]['members'] || []), s[2] ? s[1] + '.' + s[2] : s[1]]));
                a[metadataName]['name'] = 'LayoutSection'
                v['package'] = 'Layout$' + s[1] + '-' + s[2]
                this.salesforceCurrentTranslationsFiltered.push(v)
            }
            else if ((metadataName == 'CustomField' || metadataName == 'ButtonOrLink' || metadataName == 'PicklistValue' || metadataName == 'ValidationFormula') && this.matchesInclude(this.allowedMetdataParents, [], s[1])) {
                //console.log("TME",this.allowedMetdataParents,s[1])
                a[metadataName] = a[metadataName] || {}
                a[metadataName]['name'] = metadataName;
                a[metadataName]['parent'] = Array.from(new Set([...(a[metadataName]['parent'] || []), s[1]]));
                a[metadataName]['members'] = Array.from(new Set([...(a[metadataName]['members'] || []), s[2] ? s[1] + '.' + s[2] : s[1]]));
                if (metadataName == 'CustomField') {
                    v['package'] = 'CustomField$' + s[1] + '.' + s[2] + '__c'
                } else if (metadataName == 'ButtonOrLink') {
                    v['package'] = 'WebLink$' + s[1] + '.' + s[2]
                } else if (metadataName == 'PicklistValue') {
                    v['package'] = 'CustomField$' + s[1] + '.' + s[2] + '__c'
                } else if (metadataName == 'ValidationFormula') {
                    v['package'] = 'ValidationRule$' + s[1] + '.' + s[2]
                }
                v.parent=s[1];
                this.salesforceCurrentTranslationsFiltered.push(v)

            }
            else if (metadataName == 'CustomLabel' && this.matchesInclude(allowedCustomLabels, excludedCustomLabels, s[1], this.customLabelInfoMap[s[1]])) {
                //console.log("TME",s[1])
                a[metadataName] = a[metadataName] || {}
                a[metadataName]['name'] = metadataName;
                a[metadataName]['parent'] = Array.from(new Set([...(a[metadataName]['parent'] || []), s[1]]));
                a[metadataName]['members'] = Array.from(new Set([...(a[metadataName]['members'] || []), s[2] ? s[1] + '.' + s[2] : s[1]]));
                v['package'] = 'CustomLabel$' + s[1]
                this.salesforceCurrentTranslationsFiltered.push(v)
            }
            else if (metadataName == 'QuickAction' && this.matchesInclude(allowedQuickActions, [], s[1] + (s[2] ? '.' + s[2] : ''))) {
                a[metadataName] = a[metadataName] || {}
                a[metadataName]['name'] = metadataName;
                a[metadataName]['parent'] = Array.from(new Set([...(a[metadataName]['parent'] || []), s[1]]));
                a[metadataName]['members'] = Array.from(new Set([...(a[metadataName]['members'] || []), s[2] ? s[1] + '.' + s[2] : s[1]]));
                v['package'] = 'QuickAction$' + (s[2] ? s[1] + '.' + s[2] : s[1])
                v.parent=s[1];
                this.salesforceCurrentTranslationsFiltered.push(v)
            } else if (false) {//For Future
                a[metadataName] = a[metadataName] || {}
                a[metadataName]['name'] = metadataName;
                a[metadataName]['parent'] = Array.from(new Set([...(a[metadataName]['parent'] || []), s[1]]));
                a[metadataName]['members'] = Array.from(new Set([...(a[metadataName]['members'] || []), s[2] ? s[1] + '.' + s[2] : s[1]]));
            }

            return a;
        }, {})
        fs.writeFileSync(this.config.TranslationValidations + '/sfctMetadataMap.json', JSON.stringify(this.sfctMetadataMap, null, 2).replace(/CEC_ShipmentIdentifierType__c/g, "CEC_ShipmentIdentifierType__mdt"))



    }
    generateTranslationProvided() {
        this.newItems.sort((a, b) => (a.label > b.label) ? 1 : -1)

        var join = (array, joincolumn, count) => {
            var items = [];
            var uniqueByColumn = array.reduce((a, v) => {
                a[v[joincolumn]] = [...(a[v[joincolumn]] || []), v];
                return a;
            }, {})
            //console.log("TME",uniqueByColumn);return;
            for (let key in uniqueByColumn) {
                //if(uniqueByColumn[key].length==1)continue;
                var uniquItem = {}
                for (let item of uniqueByColumn[key]) {
                    for (let column in item) {
                        uniquItem[column] = [...(uniquItem[column] || []), item[column]]
                    }
                }
                for (let column in uniquItem) {
                    var values = Array.from(new Set(uniquItem[column]))
                    uniquItem[column] = values.join(' | ')
                }
                items.push(uniquItem)
            }
            return items;
        }
        this.uniqueNewItems = join(this.newItems, "label")


        var translationsProvided = this.uniqueNewItems.reduce((a, v) => {
            a[v.label] = v
            a[encode(v.label)] = v
            return a
        }, {})
        fs.writeFileSync(this.config.TranslationValidations + '/transaltions.json', JSON.stringify(translationsProvided, null, 2).replace(/CEC_ShipmentIdentifierType__c/g, "CEC_ShipmentIdentifierType__mdt"))

        var translationsProvided = fs.readFileSync(this.config.TranslationValidations + '/transaltions.json', 'utf-8');
        //console.log("TME",JSON.parse(translationsProvided))
        return JSON.parse(translationsProvided)

    }
    processTransaltionRequestSheets() {
        if (this.config.processTransaltionRequestExcels) {
            fs.readdirSync(this.config.transaltionRequestExcels)
                .map(file => {
                    var workbook = XLSX.readFile(this.config.transaltionRequestExcels + '/' + file, { cellStyles: true })

                    workbook.SheetNames.forEach(sheet_name => {
                        if (sheet_name == "PROJECT STATUS") {
                            return
                        }
                        //console.log("TME",first_sheet_name)
                        /* Get worksheet */
                        var worksheet = workbook.Sheets[sheet_name];
                        var getSheetValue = (row, column) => {
                            var value = ((worksheet[XLSX.utils.encode_cell({ c: column, r: row })] || {}).v || "")
                            //console.log("TME",value)
                            return (value + "").trim()
                        }

                        var getSheetCellstyle = (row, column) => {
                            var style = ((worksheet[XLSX.utils.encode_cell({ c: column, r: row })] || {}).s || {})
                            //console.log("TME",value)
                            return style
                        }

                        var getLanguage = (label, C, splitBy, labelindex) => {
                            //console.log("TME",file.padEnd(60),first_sheet_name.padEnd(40),label)
                            var languges = { label }
                            for (let i = 3; i <= 30; i++) {

                                //Creating Langiage Key
                                var key = (getSheetValue(i, 0) || "") + (getSheetValue(i, 1) || "")
                                console.log('transaltationMetadataExtractor|', key, '|', sheet_name, 'file')
                                if (key) {
                                    var languageFind = this.languages.find(v2 => v2.Label == key)
                                    if (languageFind) {
                                        key = languageFind.Language;
                                        //console.log("TME",file,",",first_sheet_name,",",key)


                                        var translated = splitBy ? getSheetValue(i, C).split(splitBy)[labelindex] || "" : getSheetValue(i, C)
                                        var style = getSheetCellstyle(i, C)
                                        if (style && style.fgColor) {
                                            languges.styles = [...new Set([...(languges.styles || []), style.fgColor.rgb])]
                                        }
                                        //console.log("TME",label,key,translated,splitBy,labelindex)
                                        if (label.indexOf('Application') >= 0) {
                                            console.log("TME", "Log", style)
                                        }
                                        // To fix Dynamic content - Needs to be moved to sheet
                                        if (label == "{0} characters remaining") {
                                            translated = translated.replace("255", "{0}")
                                            //console.log("TME",translated)

                                        }
                                        // To fix 1 vaues
                                        if (translated == "1") {
                                            translated = ""
                                        }

                                        languges[key] = translated.replace(/\r?\n|\r/g, '').trim()//Untill pro

                                        if (languges[key]) {
                                            this.translatedLanguges.add(languageFind)

                                            this.languageCodes = Array.from(new Set([...this.languageCodes, key]))
                                        }

                                    }

                                }
                            }
                            var masterInfo = this.salesforceCurrentTranslationsFiltered.filter(v => v['Label'].trim().toLowerCase() == label.trim().toLowerCase())
                            if (label.indexOf('Increase priority for this Case') >= 0) {
                                //console.log("TME","Log",label,"|",this.masterWorkBookFitered,"|",masterInfo)
                            }
                            if (masterInfo.length <= 0) {
                                //console.log("TME",file,",",first_sheet_name,",", label,",", (masterInfo.length > 0 ? 'Yes' : 'NO'))
                            }
                            if (masterInfo && masterInfo.length > 0) {
                                this.translatedLabels = [...this.translatedLabels, masterInfo.filter(v => v.name == "CustomLabel").map(v => v.package)];

                            }
                            languges.package = Array.from(new Set(masterInfo.map(v => v['package']))).join(' | ') || "Misssing"
                            languges.packageName = Array.from(new Set(masterInfo.map(v => v['package'].split('$')[0]))).join(' | ') || "Misssing"

                            languges.masterInfoLabel = Array.from(new Set(masterInfo.map(v => v['Label']))).join(' | ') || "Misssing"
                            languges.file = file;
                            languges.sheet = sheet_name;


                            if (this.config.delta && (languges.styles || languges.styles == '')) {
                                this.package = Array.from(new Set([...this.package, ...masterInfo.map(v => v['package'].trim())]))
                                console.log(masterInfo,'masterInfo');
                                this.packageParents=Array.from(new Set([...this.packageParents, ...masterInfo.map(v => (v['parent'] || '').trim())]))
                                this.newItems.push(languges)
                            } else if (!this.config.delta) {
                                this.package = Array.from(new Set([...this.package, ...masterInfo.map(v => v['package'].trim())]))
                                this.newItems.push(languges)
                            }

                        }

                        var range = { s: { c: 0, r: 1 }, e: { c: 100, r: 1 } }
                        for (var C = range.s.c; C <= range.e.c; ++C) {
                            /* if an A1-style address is needed, encode the address */
                            var label = getSheetValue(1, C).replace(/\r?\n|\r/g, '')

                            if (
                                label && this.config.labelConsistency[label]
                            ) {
                                getLanguage(this.config.labelConsistency[label], C)
                            }
                            else if (
                                label &&
                                (
                                    label == 'Shipper, Consignee, 3rd Party, UPSer, Other'
                                    || label == 'Urgent, Non-Urgent'
                                    || label == 'Tracking, Shipping, Other'
                                )
                            ) {

                                label.split(',').map((v, index) => getLanguage(v.trim(), C, /,|，/, index))
                                //break;
                            }
                            else if (
                                label && label != "English (US)"
                                && label != "ORIGINAL"
                                && label != "# Fields"
                                && label != "% Complete"
                            ) {
                                getLanguage(label, C)
                                //break;
                            }
                            else if (!label) {
                                //break;
                            }

                        }
                    })
                })
        }
        if (this.config.processTransaltionRequestPicklistExcels) {
            for (let transaltionRequestPicklistExcel of this.config.transaltionRequestPicklistExcels) {
                var file = transaltionRequestPicklistExcel.file
                var workbook = XLSX.readFile(file);
                workbook.SheetNames.forEach(sheet_name => {
                    if (!transaltionRequestPicklistExcel.sheetMap[sheet_name]) {
                        return
                    }
                    var metadataInfo = transaltionRequestPicklistExcel.sheetMap[sheet_name]
                    //console.log("TME",first_sheet_name)
                    /* Get worksheet */
                    var worksheet = workbook.Sheets[sheet_name];
                    var getSheetValue = (row, column) => {
                        var value = ((worksheet[XLSX.utils.encode_cell({ c: column, r: row })] || {}).v || "")
                        //console.log("TME",value)
                        return (value + "").trim()
                    }

                    var getLanguage = (label, row) => {
                        //console.log("TME",file.padEnd(60),first_sheet_name.padEnd(40),label)
                        var languges = { label }
                        for (let column = 1; column <= 100; column++) {

                            //Creating Langiage Key
                            var languageLabel = getSheetValue(0, column)

                            if (languageLabel) {
                                var languageFind = this.languages.find(v2 => v2.Label2 == languageLabel)
                                if (languageFind) {
                                    var code = languageFind.Language;
                                    //console.log("TME",file,",",first_sheet_name,",",key)

                                    this.languageCodes = Array.from(new Set([...this.languageCodes, code]))

                                    var translated = getSheetValue(row, column)


                                    languges[code] = translated.replace(/\r?\n|\r/g, '')//Untill pro
                                }

                            } else {
                                break;
                            }
                        }

                        languges.package = metadataInfo.name + '$' + metadataInfo.member
                        languges.packageName = metadataInfo.name
                        languges.file = file;
                        languges.sheet = sheet_name;
                        this.package = Array.from(new Set([...this.package, languges.package]))
                        this.newItems.push(languges)
                    }


                    //Var iterate all rows
                    for (var row = 1; row <= 2000; ++row) {
                        /* if an A1-style address is needed, encode the address */
                        var label = getSheetValue(row, 0).replace(/\r?\n|\r/g, '')

                        if (
                            label
                        ) {
                            getLanguage(label, row)
                            //break;
                        }
                        else if (!label) {
                            console.log(`Breaking at row ${row} for ${sheet_name} `)
                            break;
                        }

                    }
                })

            }
        }


    }

    getTranslationTypes(name) {
        switch (name) {
            case "CustomLabel":
            case "Layout":
                return 'Translations'
                break;

            case "CustomField":
            case "QuickAction":
            case "ValidationRule":
                return 'CustomObjectTranslation'
                break;


            case "StandardValueSet":
                return 'StandardValueSetTranslation'
                break;

            case "GlobalValueSet":
                return 'GlobalValueSetTranslation'
                break;

            default:
                break;
        }
    }


    async generatePackageXMl() {
        //console.log(this.package)
        this.package.sort()
        this.packageTyeps = this.package.reduce((types, p) => {
            var s = p.split('$')
            var name = s[0], member = s[1]

            var type = types.find(type => type.name == name)
            if (!type) {
                type = { name, members: [] }
                types.push(type)
            }
            var transaltionType = types.find(type => type.name == this.getTranslationTypes(name))
            if (!transaltionType) {
                transaltionType = { name: this.getTranslationTypes(name), members: [] }
                types.push(transaltionType)
            }

            if (transaltionType.name == 'Translations' && transaltionType.members.length == 0) {
                transaltionType.members = this.languageCodes;
            }
            if (transaltionType.name == 'CustomObjectTranslation' && transaltionType.members.length == 0) {
                console.log(this.packageParents,'this.packageParents');
                transaltionType.members = this.packageParents.reduce((members, customOBject) => [...members, ...this.languageCodes.map(v => `${customOBject}-${v}`)], [])
            }
            if (transaltionType.name == 'StandardValueSetTranslation') {
                transaltionType.members = [...transaltionType.members, ...this.languageCodes.map(v => `${member}-${v}`)]
            }
            if (transaltionType.name == 'GlobalValueSetTranslation') {
                transaltionType.members = [...transaltionType.members, ...this.languageCodes.map(v => `${member}-${v}`)]
            }
            type.members.push(member)

            return types
        }, [])

        var packagexml = await this.sourceSfdx.getPackageXml(this.packageTyeps);
        packagexml = packagexml.replace(/CEC_ShipmentIdentifierType__c/g, "CEC_ShipmentIdentifierType__mdt")


        fs.writeFileSync(this.config.SFDXProject + "/manifest/package-translation.xml", packagexml)
        return packagexml
    }


    creatCSV = function (newItems, name) {
        const replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here
        const header = Object.keys(newItems[0])
        const csv = [
            header.join(','), // header row first
            ...newItems.map(row => header.map(fieldName => '"' + (row[fieldName] || "") + "".replace(/"/g, '""').replace(/\r?\n|\r/g, '') + '"').join(','))
        ].join('\r\n')

        //console.log("TME",jsonObj)
        fs.writeFileSync(name, "\ufeff" + csv)
    }
    createValidationsSheet() {
        var wb = XLSX.utils.book_new();
        wb.Props = {
            Title: "Translation Validation",
            Subject: "Translation Validation",
            Author: "Manoj",
            CreatedDate: new Date(2017, 12, 19)
        };
        wb.SheetNames.push("Text Translated");
        wb.SheetNames.push("Text Not Translated");
        wb.SheetNames.push("Text Needs Considerations");
        //console.log("TME",Object.keys(uniqueNewItems))
        wb.Sheets["Text Translated"] = XLSX.utils.json_to_sheet(this.uniqueNewItems.filter(v => v['packageName'] != "Misssing"));
        wb.Sheets["Text Not Translated"] = XLSX.utils.json_to_sheet(this.uniqueNewItems.filter(v => v['packageName'] == "Misssing"));
        var tnc = this.salesforceCurrentTranslationsFiltered.filter(v => v.name == "CustomLabel" && this.translatedLabels.indexOf(v.package) < 0)
        wb.Sheets["Text Needs Considerations"] = XLSX.utils.json_to_sheet(tnc);
        XLSX.writeFile(wb, this.config.TranslationValidations + '/TranslationValidation.xlsx');

    }

}

module.exports = TransaltationMetadataExtractor





















