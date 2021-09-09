const fs = require('fs')

var convert = require('xml-js');

var decode = require('decode-html');
var encode = require('encode-html');

var sfdxdir = '../../force-app/main/default'
var valiadtionDir = 'C:/Users/manchoud1/Documents/Projects/UPS/UPSDev2/force-app/main/default'
var mdapidir = 'C:/Users/manchoud1/Documents/Projects/UPS/UPSGIT/DRIVE_SF/src'

function saveFile(filepath, tflilexml) {
    tflile = tflilexml.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/""/g, '&quot;&quot;')
        .replace(new RegExp('&amp;apos;', 'g'), '&apos;');//as js2xml not handling &apos; properly
    var res = filepath.charAt(tflile.length - 1);

    fs.writeFileSync(filepath, tflile + (res != "\n" ? "\n" : ""))

}

function handlCommments(node){
	if(node && node._comment){
		console.log(node._comment)
		node._text= '<!--'+node._comment+'-->'
		delete node._comment
	}
    return node
}
function handlCommmentsObject(node){
    Object.keys(node).forEach(function(key){
        handlCommments(node[key])
    })
	
    return node
}


function processLabels() {
    var sfdxcustomLabels = fs.readFileSync(sfdxdir + '/labels/CustomLabels.labels-meta.xml', 'utf-8')
    var sfdxcustomLabelsjson = convert.xml2js(sfdxcustomLabels, { compact: true, spaces: 4 });
    var sfdxlabels = sfdxcustomLabelsjson.CustomLabels.labels.reduce(function (result, label) {
        //console.log(label)
        result[label.fullName._text] = label
        return result
    }, {})
    //console.log(sfdxlabels)
    var filepath = mdapidir + '/labels/CustomLabels.labels'
    var mdapicustomLabels = fs.readFileSync(filepath, 'utf-8')
    var mdapicustomLabelsjson = convert.xml2js(mdapicustomLabels, { compact: true, spaces: 4 });
    //console.log(mdapicustomLabelsjson)
    var mdapilabels = mdapicustomLabelsjson.CustomLabels.labels.reduce(function (result, label) {
        //console.log(label.fullName)
        result[label.fullName._text] = label
        return result
    }, {})
    //console.log(mdapilabels)
    mdapicustomLabelsjson.CustomLabels.labels=[]
    Object.keys(sfdxlabels).forEach((labelAPIName) => {
        if (!mdapilabels[labelAPIName]) {
            console.log("<members>"+labelAPIName+"</members>")

            mdapicustomLabelsjson.CustomLabels.labels.push(Object.assign({},sfdxlabels[labelAPIName]))
        } else if (mdapilabels[labelAPIName].value._text != sfdxlabels[labelAPIName].value._text) {
            //console.log("<members>"+labelAPIName+"</members>")

            //mdapilabels[labelAPIName].value._text=decode(sfdxlabels[labelAPIName].value._text)
        } else {

            //mdapilabels[labelAPIName].value._text=encode(mdapilabels[labelAPIName].value._text)
        }
    })
    Object.keys(mdapilabels).forEach((labelAPIName) => {
        if (!sfdxcustomLabels[labelAPIName]) {
            if ('CEC_Bypass_Inbound_Email_Response_Body' == labelAPIName) {
                //console.log(mdapilabels[labelAPIName].value._text)
                mdapilabels[labelAPIName].value._text = decode(mdapilabels[labelAPIName].value._text)
                //console.log(mdapilabels[labelAPIName].value._text)
            }
        }
    })
    var mdapicustomLabelsxml = convert.js2xml(mdapicustomLabelsjson, {
        compact: true,
        ignoreComment: false,
        spaces: 4,
        textFn: function (value) {
            //console.log(value)
            return value//.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    });
    saveFile(filepath+'test', mdapicustomLabelsxml)
}

function processLabelTranslations() {
    fs.readdirSync(sfdxdir+'/translations').forEach(function(file,index){
        // if(index>0){
        //     return
        // }
        var sfdxcustomLabelTranslations = fs.readFileSync(sfdxdir + '/translations/'+file, 'utf-8')
        var sfdxcustomLabelTranslationsjson = convert.xml2js(sfdxcustomLabelTranslations, { compact: true, spaces: 4 });
        var sfdxlabels = sfdxcustomLabelTranslationsjson.Translations.customLabels.reduce(function (result, label) {
            //console.log(label)
            result[label.name._text] = label
            return result
        }, {})
        //console.log(sfdxlabels)
        var filepath = mdapidir + '/translations/'+file.replace('-meta.xml','')
        var mdapicustomLabelTranslations = fs.readFileSync(filepath, 'utf-8')
        var mdapicustomLabelTranslationsjson = convert.xml2js(mdapicustomLabelTranslations, { compact: true, spaces: 4 });
        //console.log(mdapicustomLabelTranslationsjson)
        var mdapilabels = mdapicustomLabelTranslationsjson.Translations.customLabels.reduce(function (result, label) {
            //console.log(label.fullName)
            result[label.name._text] = label
            return result
        }, {})
        //console.log(mdapilabels)
        mdapicustomLabelTranslationsjson.Translations.customLabels=mdapicustomLabelTranslationsjson.Translations.customLabels.map(v=>handlCommmentsObject(v))
        
        Object.keys(sfdxlabels).forEach((labelAPIName) => {
            if (!mdapilabels[labelAPIName]) {
                console.log("<members>"+labelAPIName+"</members>")

                mdapicustomLabelTranslationsjson.Translations.customLabels.push(handlCommmentsObject(Object.assign({},sfdxlabels[labelAPIName])))
            }
        })

        var mdapicustomLabelTranslationsxml = convert.js2xml(mdapicustomLabelTranslationsjson, {
            compact: true,
            ignoreComment: false,
            spaces: 4,
            textFn: function (value) {
                //console.log(value)
                return value.replace(/"/g, '&quot;').replace(/'/g,"&apos;");//.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
        });
        saveFile(filepath, mdapicustomLabelTranslationsxml)
        saveFile(valiadtionDir + '/translations/'+file, mdapicustomLabelTranslationsxml)
    })
}

//processLabels()
processLabelTranslations()