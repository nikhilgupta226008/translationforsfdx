const fs = require('fs')

const xmldom_sfdx_encoding = require("xmldom-sfdx-encoding");


class SfdxFile{
	sfdxdir;
	metadata;
	filepath;
	metadataName;
	xmlAttributes;
	childSfdxFile=new Map();
	constructor(sfdxdir,filepath){
		this.sfdxdir=sfdxdir;
		this.filepath = filepath;
		
	}
	create(){
		if(this.filepath){
			this.metadata=this.parseMetadataFile(this.filepath)
		}else{
			this.metadata=this.getOuterXml(this.metadataName, this.xmlAttributes)
		}
	}
	parseMetadata(xml){
		const errHandlerResults = [];
		const errHandler = (key, message) => {
			errHandlerResults.push({ key, message });
		};
		var xmlDom = new xmldom_sfdx_encoding_1.DOMParser({ errorHandler }).parseFromString(xml, 'application/xml');
		if (errHandlerResults.length > 0) {
			console.error(error)
		}
		return xmlDom;
	}
	parseMetadataFile(path){
		return this.parseMetadata(fs.readdirSync(this.sfdxdir+path))
	}
	serialize(document, pretty) {
        if (pretty) {
            this.beautifyDocument(document);
        }
        return new xmldom_sfdx_encoding.XMLSerializer().serializeToString(document);
    }
	beautifyDocument(document) {
        this.stripWhitespace(document);
        this.addWhitespace(document);
    }
	isWhitespaceOrEmpty = function (text) {
		return !/[^\s]/.test(text);
	};
	getWhitespace(indent) {
        const tabSpaces = '    ';
        let whitespace = '\n';
        for (let i = 0; i < indent; ++i) {
            whitespace = whitespace + tabSpaces;
        }
        return whitespace;
    }
    isEmptyElement(node) {
        return node.childNodes.length === 0;
    }
    isSimpleElement(node) {
        const nodeTypeText = 3;
        const nodeTypeComment = 8;
        return (node.childNodes.length === 1 &&
            (node.firstChild.nodeType === nodeTypeText || node.firstChild.nodeType === nodeTypeComment));
    }
	insertAfter(node, refNode) {
        if (refNode.nextSibling !== null) {
            refNode.parentNode.insertBefore(node, refNode.nextSibling);
        }
        else {
            refNode.parentNode.appendChild(node);
        }
    }
    addWhitespaceNodes(document, node, indent) {
        if (node !== null) {
            const nodeTypeElement = 1;
            if (node.nodeType === nodeTypeElement) {
                if (!this.isEmptyElement(node) && !this.isSimpleElement(node)) {
                    node.insertBefore(document.createTextNode(this.getWhitespace(indent + 1)), node.firstChild);
                }
                this.insertAfter(document.createTextNode(this.getWhitespace(node.nextSibling !== null ? indent : indent - 1)), node);
            }
            let child = node.firstChild;
            while (child !== null) {
                this.addWhitespaceNodes(document, child, indent + 1);
                child = child.nextSibling;
            }
        }
    }
	addWhitespace(document) {
        document.insertBefore(document.createTextNode(XmlMetadataDocument.getWhitespace(0)), document.documentElement);
        this.addWhitespaceNodes(document, document.documentElement, 0);
    }
	stripWhitespace(node){
		if (node !== null) {
			const nodeTypeText = 3;
			if (node.nodeType === nodeTypeText) {
				if (this.isWhitespaceOrEmpty(node.nodeValue)) {
					node.parentNode.removeChild(node);
				}
			}
			else {
				let child = node.firstChild;
				while (child !== null) {
					const current = child;
					child = child.nextSibling;
					this.stripWhitespaceNodes(current);
				}
			}
		}
	}
	stripWhitespaceNodes = function (node) {
		if (node !== null) {
			const nodeTypeText = 3;
			if (node.nodeType === nodeTypeText) {
				if (this.isWhitespaceOrEmpty(node.nodeValue)) {
					node.parentNode.removeChild(node);
				}
			}
			else {
				let child = node.firstChild;
				while (child !== null) {
					const current = child;
					child = child.nextSibling;
					this.stripWhitespaceNodes(current);
				}
			}
		}
	}
	getOuterXml(metadataName, xmlAttributes) {
        const xmlDecl = '<?xml version="1.0" encoding="UTF-8"?>';
        const attributes = this.getXmlAttributesString(xmlAttributes);
        const rootElement = `<${metadataName}${attributes}/>`;
        return `${xmlDecl}${rootElement}`;
    }
    getXmlAttributesString(xmlAttributes) {
        if (xmlAttributes) {
            return xmlAttributes
                .filter(attribute => attribute.nodeName && attribute.nodeValue)
                .reduce((accumulatedString, attribute) => `${accumulatedString} ${attribute.nodeName}="${attribute.nodeValue}"`, '');
        }
        return '';
    }
}

module.exports = SfdxFile