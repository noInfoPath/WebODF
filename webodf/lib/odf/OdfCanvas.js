/*global runtime odf*/
runtime.loadClass("odf.OdfContainer");
/**
 * This class manages a loaded ODF document that is shown in an element.
 * It takes care of giving visual feedback on loading, ensures that the
 * stylesheets are loaded.
 **/
odf.OdfCanvas = (function () {
    var namespaces = (new odf.Style2CSS()).namespaces,
        drawns  = namespaces.draw,
        fons    = namespaces.fo,
        svgns   = namespaces.svg,
        textns  = namespaces.text,
        xlinkns = namespaces.xlink,
        window = runtime.getWindow(),
        editparagraph;

    /**
     * @param {!Element} element
     * @return {undefined}
     */
    function clear(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
    /**
     * A new styles.xml has been loaded. Update the live document with it.
     * @param {!Element} odfelement
     * @param {!HTMLStyleElement} stylesxmlcss
     * @return {undefined}
     **/
    function handleStyles(odfelement, stylesxmlcss) {
        // update the css translation of the styles    
        var style2css = new odf.Style2CSS();
        style2css.style2css(stylesxmlcss.sheet, odfelement.styles,
                    odfelement.automaticStyles);
    }
    /**
     * @param {!string} id
     * @param {!Element} frame
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     **/
    function setFramePosition(id, frame, stylesheet) {
        frame.setAttribute('styleid', id);
        var rule,
            anchor = frame.getAttributeNS(textns, 'anchor-type'),
            x = frame.getAttributeNS(svgns, 'x'),
            y = frame.getAttributeNS(svgns, 'y'),
            width = frame.getAttributeNS(svgns, 'width'),
            height = frame.getAttributeNS(svgns, 'height'),
            minheight = frame.getAttributeNS(fons, 'min-height'),
            minwidth = frame.getAttributeNS(fons, 'min-width'); 
        if (anchor === "as-char") {
            rule = 'display: inline-block;';
        } else if (anchor || x || y) {
            rule = 'position: absolute;';
        } else if (width || height || minheight || minwidth) {
            rule = 'display: block;';
        }
        if (x) {
            rule += 'left: ' + x + ';';
        }
        if (y) {
            rule += 'top: ' + y + ';';
        }
        if (width) {
            rule += 'width: ' + width + ';';
        }
        if (height) {
            rule += 'height: ' + height + ';';
        }
        if (minheight) {
            rule += 'min-height: ' + minheight + ';';
        }
        if (minwidth) {
            rule += 'min-width: ' + minwidth + ';';
        }
        if (rule) {
            rule = 'draw|' + frame.localName + '[styleid="' + id + '"] {' +
                rule + '}';
            stylesheet.insertRule(rule, stylesheet.cssRules.length);
        }
    }
    /**
     * @param {!string} id
     * @param {!Object} container
     * @param {!Element} image
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     **/
    function setImage(id, container, image, stylesheet) {
        image.setAttribute('styleid', id);
        var url = image.getAttributeNS(xlinkns, 'href'),
            part;
        function callback(url) {
            var rule = "background-image: url(" + url + ");";
            rule = 'draw|image[styleid="' + id + '"] {' + rule + '}';
            stylesheet.insertRule(rule, stylesheet.cssRules.length);
        }
        try {
            if (container.getPartUrl) {
                url = container.getPartUrl(url);
                callback(url);
            } else {
                part = container.getPart(url);
                part.onchange = function (part) {
                    callback(part.url);
                };
                part.load();
            }
        } catch (e) {
            runtime.log('slight problem: ' + e);
        }
    }
    /**
     * @param {!Object} container
     * @param {!Element} odfbody
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     **/
    function modifyImages(container, odfbody, stylesheet) {
        var node,
            frames,
            i,
            images;
        function namespaceResolver(prefix) {
            return namespaces[prefix];
        }
        frames = [];
        node = odfbody.firstChild;
        while (node && node !== odfbody) {
            if (node.namespaceURI === drawns) {
                frames[frames.length] = node;
            }
            if (node.firstChild) {
                node = node.firstChild;
            } else {
                while (node !== odfbody && !node.nextSibling) {
                    node = node.parentNode;
                }
                if (node.nextSibling) {
                    node = node.nextSibling;
                }
            }
        }
        for (i = 0; i < frames.length; i += 1) {
            node = frames[i];
            setFramePosition('frame' + i, node, stylesheet);
        }
        images = odfbody.getElementsByTagNameNS(drawns, 'image');
        for (i = 0; i < images.length; i += 1) {
            node = /**@type{!Element}*/(images.item(i));
            setImage('image' + i, container, node, stylesheet);
        }
    }
    /**
     * @param {Document} document Put and ODF Canvas inside this element.
     */
    function addStyleSheet(document) {
        var styles = document.createElement('style'),
            head = document.getElementsByTagName('head')[0],
            text = '', prefix;
        for (prefix in namespaces) {
            if (prefix) {
                text += "@namespace " + prefix + " url(" + namespaces[prefix] +
                        ");\n";
            }
        }
        styles.appendChild(document.createTextNode(text));
        head.appendChild(styles);
        return styles;
    }
    /**
     * @constructor
     * @param {!Element} element Put and ODF Canvas inside this element.
     */
    function OdfCanvas(element) {
        var self = this,
            document = element.ownerDocument,
            odfcontainer,
            slidecssindex = 0,
            stylesxmlcss = addStyleSheet(document),
            positioncss = addStyleSheet(document);
        /**
         * A new content.xml has been loaded. Update the live document with it.
         * @param {!Object} container
         * @param {!Element} odfnode
         * @return {undefined}
         **/
        function handleContent(container, odfnode) {
            var css = positioncss.sheet;
            modifyImages(container, odfnode.body, css);
            slidecssindex = css.insertRule(
                'office|presentation draw|page:nth-child(1n) { display:block; }',
                css.cssRules.length);    
    
            // only append the content at the end
            clear(element);
            element.appendChild(odfnode);
        }
        /**
         * @param {!Object} container
         * @return {undefined}
         **/
        function refreshOdf(container) {
            if (odfcontainer !== container) {
                return;
            }
 
            // synchronize the object a window.odfcontainer with the view
            function callback() {
                clear(element);
                var odfnode = container.rootElement;
                element.ownerDocument.importNode(odfnode, true);
                handleStyles(odfnode, stylesxmlcss);
                // do content last, because otherwise the document is constantly
                // updated whenever the css changes
                handleContent(container, odfnode);
            }
        
            if (odfcontainer.state === odf.OdfContainer.DONE) {
                callback();
            } else { //if (state === OdfContainer.LOADING) {
                odfcontainer.onchange = callback;
            }
        }

        this.odfContainer = function () {
            return odfcontainer;
        };

        /**
         * @param {!string} url
         * @return {undefined}
         */
        this.load = function (url) {
            element.innerHTML = 'loading ' + url;
            // open the odf container
            odfcontainer = new odf.OdfContainer(url);
            odfcontainer.onstatereadychange = refreshOdf;
        };

        function listenEvent(eventTarget, eventType, eventHandler) {
            if (eventTarget.addEventListener) {
                eventTarget.addEventListener(eventType, eventHandler, false);
            } else if (eventTarget.attachEvent) {
                eventType = "on" + eventType;
                eventTarget.attachEvent(eventType, eventHandler);
            } else {
                eventTarget["on" + eventType] = eventHandler;
            }
        }

        function cancelPropagation(event) {
            if (event.stopPropagation) {
                event.stopPropagation();
            } else {
                event.cancelBubble = true;
            }
        }

        function cancelEvent(event) {
            if (event.preventDefault) {
                event.preventDefault();
                event.stopPropagation();
            } else {
                event.returnValue = false;
                event.cancelBubble = true;
            }
        }

        function stopEditing() {
            var fragment = editparagraph.ownerDocument.createDocumentFragment();
            while (editparagraph.firstChild) {
                fragment.insertBefore(editparagraph.firstChild, null);
            }
            editparagraph.parentNode.replaceChild(fragment, editparagraph);
        }

        function processClick(evt) {
            evt = evt || window.event;
            // go up until we find a text:p, if we find it, wrap it in <p> and make that
            // editable
            var e = evt.target, selection = window.getSelection(),
                range = selection.getRangeAt(0),
                startContainer = range && range.startContainer,
                startOffset = range && range.startOffset,
                endContainer = range && range.endContainer,
                endOffset = range && range.endOffset;
            while (e && !((e.localName === "p" || e.localName === "h") &&
                    e.namespaceURI === textns)) {
                e = e.parentNode;
            }
            if (!e || e.parentNode === editparagraph) {
                return;
            }

            if (!editparagraph) {
                editparagraph = e.ownerDocument.createElement("p");
                editparagraph.setAttribute("contenteditable", true);
                editparagraph.style.margin = "0px";
                editparagraph.style.padding = "0px";
                editparagraph.style.border = "0px";
            } else if (editparagraph.parentNode) {
                stopEditing();
            }
            e.parentNode.replaceChild(editparagraph, e);
            editparagraph.appendChild(e);

            // set the cursor or selection at the right position
            editparagraph.focus(); // needed in FF to show cursor in the paragraph
            if (range) {
                selection.removeAllRanges();
                range = e.ownerDocument.createRange();
                range.setStart(startContainer, startOffset);
                range.setEnd(endContainer, endOffset);
                selection.addRange(range);
            }
            cancelEvent(evt);
        }

        listenEvent(element, "click", processClick);
    }
    return OdfCanvas;
}());
