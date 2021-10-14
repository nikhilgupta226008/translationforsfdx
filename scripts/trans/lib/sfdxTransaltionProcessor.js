const fs = require('fs')

var convert = require('xml-js');

var decode = require('decode-html');
var encode = require('encode-html');

const sfdxFile = require('./sfdxfile');

function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function getReg(string) {
	return new RegExp(escapeRegExp(string), 'i')
}

var sfdxdir = '../../force-app/main/default'



function saveFile(filepath, tflilexml) {
	tflile = tflilexml.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
		.replace(/""/g, '&quot;&quot;')
		.replace(new RegExp('&amp;apos;', 'g'), '&apos;')//as js2xml not handling &apos; properly
		.replace(/<label\/>/g, "<label></label>")
	var res = filepath.charAt(tflile.length - 1);

	fs.writeFileSync(filepath, tflile + (res != "\n" ? "\n" : ""))

}

function arr_diff(a1, a2) {

	var a = [], diff = [];

	for (var i = 0; i < a1.length; i++) {
		a[a1[i]] = true;
	}

	for (var i = 0; i < a2.length; i++) {
		if (a[a2[i]]) {
			delete a[a2[i]];
		} else {
			a[a2[i]] = true;
		}
	}

	for (var k in a) {
		diff.push(k);
	}

	return diff;
}


function getArray(instance) {
	if (instance && instance.length) {
		return instance
	} else if (instance) {
		return [instance]
	} else {
		return []
	}
}

function handlCommments(node) {
	if (node && node._comment) {
		//console.log('sfdxTransaltionProcessor | ',encode(decode(node._comment)))
		node._text = '<!--' + node._comment + '-->'
		delete node._comment
	}
}

function handlCommmentsInList(nodes) {
	if (nodes && nodes.length) {
		nodes.forEach(node => {
			Object.keys(node).forEach(k => {
				handlCommments(node[k])
			})

		})
	} else if (nodes && nodes._comment) {
		handlCommments(nodes)
	}
	else if (nodes) {
		Object.keys(nodes).forEach(k => {
			handlCommments(nodes[k])
		})

	}
}

function gettranslationsProvided() {

	// fs.writeFileSync('transaltions.json',JSON.stringify(translationsProvided))
	var translationsProvided = JSON.parse(fs.readFileSync('TranslationValidations/transaltions.json', 'utf-8'));
	return translationsProvided

}

function getQuickActionMap() {
	try {

		var quickActionsMap = fs.readdirSync(sfdxdir + '/quickActions')
			.map(file => {
				return { xml: convert.xml2js(fs.readFileSync(sfdxdir + '/quickActions/' + file, 'utf-8'), { compact: true, spaces: 4 }), name: file }
			}).reduce((acc, v) => {
				//console.log('sfdxTransaltionProcessor | ',v)
				if (v.xml.QuickAction && v.xml.QuickAction.label) {

					acc[v.name.replace('.quickAction-meta.xml', "")] = v.xml.QuickAction.label._text
				}
				return acc
			}, {})
		return quickActionsMap
	} catch (error) {
		console.log('sfdxTransaltionProcessor |', error.message)
	}
}

function processFieldsAndLayout(languages, sObjects) {
	try {
		var fields = {}
		sObjects.forEach(sObject => {

			var fieldsSobject = sObject == 'PersonAccount' ? 'Account' : sObject
			fields[sObject] = []
		try{
			var customFields = fs.readdirSync(sfdxdir + '/objects/' + fieldsSobject + '/fields')
		
				.map(file => {
					return convert.xml2js(fs.readFileSync(sfdxdir + '/objects/' + fieldsSobject + '/fields/' + file, 'utf-8'), { compact: true, spaces: 4 })
				}).reduce((acc, v) => {
					//console.log('sfdxTransaltionProcessor | ',v)
					if (v.CustomField && v.CustomField.label) {
						acc[v.CustomField.fullName._text] = decode(v.CustomField.label._text)
						acc[encode(v.CustomField.fullName._text)] = decode(v.CustomField.label._text)
					}
					return acc
				}, {})
			
			var customFieldsRelationships = fs.readdirSync(sfdxdir + '/objects/' + fieldsSobject + '/fields')
				.map(file => {
					return convert.xml2js(fs.readFileSync(sfdxdir + '/objects/' + fieldsSobject + '/fields/' + file, 'utf-8'), { compact: true, spaces: 4 })
				}).reduce((acc, v) => {
					if (v.CustomField && v.CustomField.relationshipLabel) {
						acc[v.CustomField.fullName._text] = decode(v.CustomField.relationshipLabel._text)
						acc[encode(v.CustomField.fullName._text)] = decode(v.CustomField.relationshipLabel._text)
					}
					return acc
				}, {})
			
			//console.log('sfdxTransaltionProcessor | ',"LOG FR",fieldsSobject,customFieldsRelationships)	;


			languages.forEach(l => {
				var logs = [];
				var translated = {};
				logs.push('Language ' + l)


				var dirPrefix = sfdxdir + '/objectTranslations/' + sObject + '-'

				var dirpath = dirPrefix + l
				fs.readdirSync(dirPrefix + l).forEach(file => {
					var filepath = dirPrefix + l + '/' + file
					//console.log('sfdxTransaltionProcessor | ',dirPrefix+l+'/'+file);
					var tflile = fs.readFileSync(filepath, 'utf-8')
					tflilejson = convert.xml2js(tflile, { compact: true, spaces: 4 });

					if (tflilejson.CustomFieldTranslation && customFields) {
						//console.log('sfdxTransaltionProcessor | ',tflilejson.CustomFieldTranslation)
						var v = tflilejson.CustomFieldTranslation
						if (translationsProvided[customFields[v.name._text]] && translationsProvided[customFields[v.name._text]][l]) {
							delete v.label._comment
							v.label._text = encode(translationsProvided[customFields[v.name._text]][l])
							//console.log('sfdxTransaltionProcessor | ','Success F', '|', customFields[v.name._text], '|', l)
							fields[sObject].push(v.name._text)
							transaltedFoundLabels.add(customFields[v.name._text])
						} else {

							handlCommments(v.label)
						}

						if (translationsProvided[customFieldsRelationships[v.name._text]] && translationsProvided[customFieldsRelationships[v.name._text]][l]) {
							delete v.label._comment
							v.label._text = encode(translationsProvided[customFieldsRelationships[v.name._text]][l])
							//console.log('sfdxTransaltionProcessor | ','Success FR', '|', customFieldsRelationships[v.name._text], '|', l)
							fields[sObject].push(v.name._text)
							transaltedFoundLabels.add(customFieldsRelationships[v.name._text])
						}



						handlCommments(v.help)
						if (v.relationshipLabel)
							handlCommments(v.relationshipLabel)
						//handlCommmentsInList(v.picklistValues)
						//console.log('sfdxTransaltionProcessor | ',v.picklistValues)
						getArray(v.picklistValues).forEach(v => {
							var comment = decode((v.translation._comment || v.masterLabel._text || '').trim())
							//console.log('sfdxTransaltionProcessor | ',translationsProvided[comment],comment)
							if (translationsProvided[comment] && translationsProvided[comment][l]) {

								v.translation._text = encode(translationsProvided[comment][l])
								//console.log('sfdxTransaltionProcessor | ','Success Picklist', '|', comment, '|', v.translation._text, '|', l)
								delete v.translation._comment
								transaltedFoundLabels.add(comment)
							} else {
								handlCommments(v.translation)
							}


						})






					}
					if (tflilejson.CustomObjectTranslation) {
						var quickActionsMap = getQuickActionMap()

						//console.log('sfdxTransaltionProcessor | ',"Log: quickActions",tflilejson.CustomObjectTranslation.quickActions,quickActionsMap)
						if (quickActionsMap)
							getArray(tflilejson.CustomObjectTranslation.quickActions).forEach(v => {
								var label = quickActionsMap[sObject + '.' + v.name._text]
								//console.log('sfdxTransaltionProcessor | ',quickActionsMap[sObject + '.' + v.name._text], sObject + '.' + v.name._text)
								if (translationsProvided[label] && translationsProvided[label][l]) {

									v.label._text = encode(translationsProvided[label][l])
									//console.log('sfdxTransaltionProcessor | ','Success Q', '|', label, '|', l)
									delete v.label._comment
									transaltedFoundLabels.add(label)
								} else {
									handlCommments(v.label)
								}


							})

						getArray(tflilejson.CustomObjectTranslation.layouts).forEach(layout => {

							layout.sections.forEach(v => {
								var comment = decode((v.label._comment || v.section._text).trim())
								//console.log('sfdxTransaltionProcessor | ',translationsProvided[comment],v.label._comment)
								if (translationsProvided[comment] && translationsProvided[comment][l]) {

									v.label._text = encode(translationsProvided[comment][l])
									//console.log('sfdxTransaltionProcessor | ','Success S', '|', translationsProvided[comment][l], '|', comment, '|', l)
									delete v.label._comment
									transaltedFoundLabels.add(comment)
								} else {
									handlCommments(v.label)
								}


							})

						})
						console.log('tflilejson.CustomObjectTranslation.validationRules',tflilejson.CustomObjectTranslation.validationRules);
						getArray(tflilejson.CustomObjectTranslation.validationRules).forEach(v => {
							var comment = (v.errorMessage._comment || '').trim()
							console.error("validationRules", comment, v)

							if (translationsProvided[comment] && translationsProvided[comment][l]) {

								v.errorMessage._text = encode(translationsProvided[comment][l])
								//console.log('sfdxTransaltionProcessor | ','Success V', '|', comment, '|', l)
								delete v.errorMessage._comment
								transaltedFoundLabels.add(comment)
							} else {
								handlCommments(v.errorMessage)
							}
						})
						handlCommmentsInList(tflilejson.CustomObjectTranslation.recordTypes)


						handlCommmentsInList(tflilejson.CustomObjectTranslation.caseValues)
						handlCommmentsInList(tflilejson.CustomObjectTranslation.gender)
						handlCommmentsInList(tflilejson.CustomObjectTranslation.startsWith)
					}
					var tflilexml = convert.js2xml(tflilejson, { sanitize: false, compact: true, ignoreComment: true, spaces: 4 });
					saveFile(filepath, tflilexml)

				});
			})
		}
		catch(e)
		{
			console.log('sfdxTransaltionProcessor | Missing Object ',e.message);
		}
			//console.log('sfdxTransaltionProcessor | ',sObject+' Fields',fields[sObject])
			//console.log('sfdxTransaltionProcessor | ',sObject, ' | ' + ' Fields', Array.from(new Set(fields[sObject])).map(v => "<members>" + fieldsSobject + "." + v + "</members>").join('\n'))
		})
	} catch (e) {
		console.error('sfdxTransaltionProcessor|', e.message,e)
	}

}

function processStandardPicklist(languages, standaPicklists) {
	try {
		standaPicklists.forEach(standaPicklist => {
			languages.forEach(l => {
				var logs = [];
				var translated = {};
				logs.push('Language ' + l)
				try {
					//console.log('sfdxTransaltionProcessor | ','Language ' + l)
					var filepath = sfdxdir + '/standardValueSetTranslations/' + standaPicklist + '-' + l + '.standardValueSetTranslation-meta.xml'

					var tflile = fs.readFileSync(filepath, 'utf-8')

					//Convert Translations file without single previous translation
					tflilejson = convert.xml2js(tflile, { compact: true, spaces: 4 });
					//console.log('sfdxTransaltionProcessor | ',tflilejson)

					tflilejson.StandardValueSetTranslation.valueTranslation.forEach(v => {
						var key = v.masterLabel._text.trim()
						//console.log('sfdxTransaltionProcessor | ',key,translationsProvided[key])
						if (key && translationsProvided[key] && translationsProvided[key][l]) {
							//console.log('sfdxTransaltionProcessor | ',v)
							if (v.translation._comment)
								delete v.translation._comment

							v.translation._text = encode(translationsProvided[key][l].trim());

							//console.log('sfdxTransaltionProcessor | ','Translating SPicklist', ' | ', '<label><!-- ' + key + ' --></label>', encode(translationsProvided[key][l]))

							transaltedFoundLabels.add(key)
							transaltedFoundLabels.add(encode(decode(key)))
						} else {

							handlCommments(v.translation)
						}
					})

					var tflilexml = convert.js2xml(tflilejson, { compact: true, ignoreComment: true, spaces: 4 });
					saveFile(filepath, tflilexml)
				} catch (e) {
					//console.error('sfdxTransaltionProcessor|', e.message)
				}
			})
		})
	} catch (e) {
		console.error('sfdxTransaltionProcessor|', e.message)
	}
}

function processGlobalPicklist(languages, globalPicklists) {
	try {
		globalPicklists.forEach(globalPicklist => {
			languages.forEach(l => {
				var logs = [];
				var translated = {};
				logs.push('Language ' + l)
				try {
					//console.log('sfdxTransaltionProcessor | ','Language ' + l)
					var filepath = sfdxdir + '/globalValueSetTranslations/' + globalPicklist + '-' + l + '.globalValueSetTranslation-meta.xml'
					//console.log('sfdxTransaltionProcessor | ',filepath)
					var tflile = fs.readFileSync(filepath, 'utf-8')

					//Convert Translations file without single previous translation
					tflilejson = convert.xml2js(tflile, { compact: true, spaces: 4 });
					//console.log('sfdxTransaltionProcessor | ',tflilejson)

					tflilejson.GlobalValueSetTranslation.valueTranslation.forEach(v => {
						var key = v.masterLabel._text.trim()
						//console.log('sfdxTransaltionProcessor | ',key,translationsProvided[key])
						if (key && translationsProvided[key] && translationsProvided[key][l]) {
							//console.log('sfdxTransaltionProcessor | ',v)
							if (v.translation._comment)
								delete v.translation._comment

							v.translation._text = encode(translationsProvided[key][l].trim());

							//console.log('sfdxTransaltionProcessor | ','Translating GPicklist', ' | ', '<label><!-- ' + key + ' --></label>', encode(translationsProvided[key][l]))

							transaltedFoundLabels.add(key)
							transaltedFoundLabels.add(encode(decode(key)))
						} else {

							handlCommments(v.translation)
						}
					})

					var tflilexml = convert.js2xml(tflilejson, { compact: true, ignoreComment: true, spaces: 4 });
					saveFile(filepath, tflilexml)
				} catch (e) {
					//console.error('sfdxTransaltionProcessor|', e.message)
				}

			})
		})
	} catch (e) {
		console.error('sfdxTransaltionProcessor|', e.message)
	}
}


function processLabels(languages) {


	try {
		var customLabels = fs.readFileSync(sfdxdir + '/labels/CustomLabels.labels-meta.xml', 'utf-8')
		var json = convert.xml2js(customLabels, { compact: true, spaces: 4 });
		var labels = getArray(json.CustomLabels.labels).reduce(function (result, label) {
			//console.log('sfdxTransaltionProcessor | ',label)
			result[decode(label.value._text)] = decode(label.shortDescription._text)
			//console.log('sfdxTransaltionProcessor | ',label.value._text," |  ",decode(label.value._text)," |  ",result[label.value._text])
			return result
		}, {})

		var labelsByAPINAME = getArray(json.CustomLabels.labels).reduce(function (result, label) {

			//console.log('sfdxTransaltionProcessor | ',label)
			result[label.fullName._text] = decode(label.shortDescription._text)
			//console.log('sfdxTransaltionProcessor | ',label.fullName._text," |  ",result[label.fullName._text])
			return result
		}, {})

		var labelValueByAPINAME = getArray(json.CustomLabels.labels).reduce(function (result, label) {

			//console.log('sfdxTransaltionProcessor | ',label)
			result[label.fullName._text] = decode(label.value._text)
			//console.log('sfdxTransaltionProcessor | ',label.fullName._text," |  ",result[label.fullName._text])
			return result
		}, {})



		languages.forEach(language => {
			var logs = [];
			var translated = {};
			logs.push('Language ' + language)
			try {
				//console.log('sfdxTransaltionProcessor | ','Language ' + language)
				var filepath = sfdxdir + '/translations/' + language + '.translation-meta.xml'

				var tflile = fs.readFileSync(filepath, 'utf-8')

				//Convert Translations file without single previous translation
				tflilejson = convert.xml2js(tflile, { compact: true, spaces: 4 });
				//console.log('sfdxTransaltionProcessor | ',tflilejson)

				getArray(tflilejson.Translations.customLabels).forEach(v => {
					var key = labelValueByAPINAME[v.name._text]
					if (key && translationsProvided[key] && translationsProvided[key][language]) {
						//console.log('sfdxTransaltionProcessor | ',v)
						if (v.label._comment)
							delete v.label._comment
						v.label._text = encode(translationsProvided[key][language].trim());
						//v.label._text='<!-- '+labelsByAPINAME[v.name._text]+' -->'
						//console.log('sfdxTransaltionProcessor | ','Translating Label', ' | ', '<label><!-- ' + key + ' --></label>', encode(translationsProvided[key][language]))

						transaltedFoundLabels.add(key)
						transaltedFoundLabels.add(encode(decode(key)))
					} else if (key && translationsProvidedSmallCase[key.toLowerCase()] && translationsProvidedSmallCase[key.toLowerCase()][language]) {
						//console.log('sfdxTransaltionProcessor | ',v)
						if (v.label._comment)
							delete v.label._comment
						v.label._text = encode(translationsProvidedSmallCase[key.toLowerCase()][language].trim());
						//v.label._text='<!-- '+labelsByAPINAME[v.name._text]+' -->'
						//console.log('sfdxTransaltionProcessor | ','Translating Label', ' | ', '<label><!-- ' + key.toLowerCase() + ' --></label>', encode(translationsProvidedSmallCase[key.toLowerCase()][language]))

						transaltedFoundLabels.add(key)
						transaltedFoundLabels.add(encode(decode(key)))
					} else {
						console.error('Translating Label Err', ' | ', language, '<label><!-- ' + key + ' --></label>')

						handlCommments(v.label)
					}
				})
				var quickActionsMap = getQuickActionMap()
				if (quickActionsMap)
					tflilejson.Translations.quickActions.forEach(v => {
						var key = quickActionsMap[v.name._text]
						if (key && translationsProvided[key] && translationsProvided[key][language]) {
							if (v.label._comment)
								delete v.label._comment
							v.label._text = encode(translationsProvided[key][language].trim());
							//v.label._text='<!-- '+labelsByAPINAME[v.name._text]+' -->'
							//console.log('sfdxTransaltionProcessor | ','Translating Label', ' | ', '<label><!-- ' + key + ' --></label>', encode(translationsProvided[key][language]))

							transaltedFoundLabels.add(key)
							transaltedFoundLabels.add(encode(decode(key)))
						}
					})

				var tflilexml = convert.js2xml(tflilejson, { compact: true, ignoreComment: true, spaces: 4 });
				saveFile(filepath, tflilexml)
			} catch (e) {
				console.error('sfdxTransaltionProcessor|', e.message)
			}

			//fs.writeFileSync('translation.'+l+'.log',JSON.stringify( translationsProvided ))
		})
	} catch (e) {
		console.error('sfdxTransaltionProcessor|', e.message)
	}

}

function processGlobalQuickActions(languages) {
	try {
		languages.forEach(language => {
			var logs = [];
			logs.push('Language ' + language)
			//console.log('sfdxTransaltionProcessor | ','Language ' + language)
			var filepath = sfdxdir + '/translations/' + language + '.translation-meta.xml'

			var tflile = fs.readFileSync(filepath, 'utf-8')

			//Convert Translations file without single previous translation
			tflilejson = convert.xml2js(tflile, { compact: true, spaces: 4 });
			//console.log('sfdxTransaltionProcessor | ',tflilejson)
			var quickActionsMap = getQuickActionMap()
			if (tflilejson.Translations.quickActions && quickActionsMap)
				tflilejson.Translations.quickActions.forEach(v => {
					var key = quickActionsMap[v.name._text]
					if (key && translationsProvided[key] && translationsProvided[key][language]) {
						if (v.label._comment)
							delete v.label._comment
						v.label._text = encode(translationsProvided[key][language].trim());
						//v.label._text='<!-- '+labelsByAPINAME[v.name._text]+' -->'
						//console.log('sfdxTransaltionProcessor | ','Translating Label', ' | ', '<label><!-- ' + key + ' --></label>', encode(translationsProvided[key][language]))

						transaltedFoundLabels.add(key)
						transaltedFoundLabels.add(encode(decode(key)))
					}
				})

			var tflilexml = convert.js2xml(tflilejson, { compact: true, ignoreComment: true, spaces: 4 });
			saveFile(filepath, tflilexml)

			//fs.writeFileSync('translation.'+l+'.log',JSON.stringify( translationsProvided ))
		})
	} catch (e) {
		console.error('sfdxTransaltionProcessor|', e.message)
	}

}


var transaltedFoundLabels = new Set()
var translationsProvidedSmallCase = {}
var translationsProvided = {}
module.exports = function (config, languages) {
	try {
		translationsProvided = gettranslationsProvided()

		//languages=["zh_CN","zh_TW","fr_CA","fr","de","it","pl","es","es_AR","es_MX"]
		//languages = csvToJson(fs.readFileSync('TranslationLanguages.csv', 'utf-8')).map(v => v[Object.keys(v)[0]]).filter(v => v != "en_US")

		for (key in translationsProvided) {
			for (column in translationsProvided[key]) {
				if (languages.indexOf(column) >= 0) {
					translationsProvided[key][column] = translationsProvided[key][column].split(' | ')[0].trim()

				}
			}
			translationsProvidedSmallCase[key.toLowerCase()] = translationsProvided[key]//Special Custom Label who are css capitilied
		}

		processLabels(languages)

		processGlobalQuickActions(languages)

		processFieldsAndLayout(languages, config.allowedMetdata.find(v => v.name == "CustomField").include.sObjects)

		processStandardPicklist(languages, config.allowedMetdata.find(v => v.name == "PicklistValue").include.StandardValueSet)

		processGlobalPicklist(languages, config.allowedMetdata.find(v => v.name == "PicklistValue").include.GlobalValueSet)

		console.log('sfdxTransaltionProcessor | ', arr_diff(Array.from(transaltedFoundLabels), Object.keys(translationsProvided)))
	} catch (error) {
		console.error(error.stack)
	}

}