/*global Ext runtime core listFiles*/
runtime.loadClass("core.Zip");
runtime.loadClass("core.Base64");
Ext.BLANK_IMAGE_URL = "extjs/resources/images/default/s.gif";

/**
 * @param {Ext.data.Node} node
 * @return {undefined}
 */
function addThumbnail(node) {
    var url = node.id,
    zip = new core.Zip(url, function (err, zipobject) {
        zip = zipobject;
        if (err) {
            return;
        }
        zip.load('Thumbnails/thumbnail.png', function (err, data) {
            if (data === null) {
                return;
            }
            var url = 'data:;base64,' +
                    (new core.Base64()).convertUTF8ArrayToBase64(data),
                el, spans, i, s;

            el = node.getUI().getEl();
            if (el) {
                spans = el.getElementsByTagName('span');
                for (i = 0; i < spans.length; i += 1) {
                    s = spans.item(i);
                    if (s.getAttribute('qtip')) {
                        s.setAttribute('qtip', node.attributes.qtip);
                    }
                }
            } else {
                node.attributes.qtip += '<br/><img src="' + url + '"/>';
            }
        });
    });
}

/**
 * @param {!string} url
 * @param {!Ext.TabPanel} panel
 * @param {!string} title
 * @return {undefined}
 */
function loadODF(url, panel, title) {
    var tab = panel.find('url', url),
        t,
        newTab;
    if (tab.length) {
        for (t in tab) {
            if (typeof tab[t] === 'object') {
                panel.setActiveTab(tab[t]);
                return;
            }
        }
    }
    newTab = new Ext.BoxComponent({
        title: title,
        tabTip: url,
        url: url,
        closable: true,
        autoEl: {
            tag: 'iframe',
            name: url,
            src: 'odf.html#' + url,
            frameBorder: 0,
            style: {
                border: '0 none'
            }
        },
        region: 'center'
    });
    panel.add(newTab);
    panel.setActiveTab(newTab);
}

Ext.onReady(function () {
    var editButton, tabpanel, slider, tree, viewport;

    Ext.QuickTips.init();

    /**
     * @param {!Ext.Button} button
     * @param {!boolean} pressed
     * @return {undefined}
     */
    function editToggle(button, pressed) {
        var tab = tabpanel.getActiveTab();
        if (!tab) {
            return;
        }
        tab.el.dom.contentDocument.body.contentEditable = pressed;
    }

    /**
     * @param {!Object} slider
     * @param {!number} zoomlevel
     * @param {!Object} thumb
     * @return {undefined}
     */
    function setZoom(slider, zoomlevel, thumb) {
        var tab = tabpanel.getActiveTab(),
            body;
        if (!tab) {
            return;
        }
        body = tab.el.dom.contentDocument.body;
        zoomlevel = Math.pow(10, zoomlevel / 10.0);
        body.style.zoom = zoomlevel;
        body.style.MozTransform = 'scale(' + zoomlevel + ')';
    }

    /**
     * @param {Ext.data.Node} node
     * @return {undefined}
     */
    function loadThumbnails(node) {
        var n, i;
        for (i = 0; i < node.childNodes.length; i += 1) {
            n = node.childNodes[i];
            if (n.leaf) {
                try {
                    addThumbnail(n);
                } catch (e) {
                }
            }
        }
    }

    /**
     * @param {!Ext.data.Node} root
     * @param {!string} uri
     * @return {!Ext.data.Node}
     */
    function getParentNode(root, uri) {
        var parts = uri.split('/'),
            node = root,
            id = parts[0],
            i,
            n;
        for (i = 1; i < parts.length - 1; i += 1) {
            n = node.findChild('text', parts[i], false);
            id += '/' + parts[i];
            if (!n) {
                n = {
                    id: id,
                    text: parts[i],
                    qtip: uri,
                    cls: 'folder',
                    editable: false,
                    nodeType: 'node',
                    singleClickExpand: true,
                    listeners: {
                        beforechildrenrendered: loadThumbnails
                    }
                };
                n = node.appendChild(n);
            }
            node = n;
        }
        return node;
    }

    /**
     * @param {!Array.<!string>} directories
     * @param {!Array.<!string>} files
     * @return {undefined}
     */
    function listFilesCallback(directories, files) {
        var root = tree.getRootNode(),
            i,
            f,
            parentNode,
            qtip,
            node,
            callback = function (node) {
                loadODF(node.id, tabpanel, node.text);
            };
        for (i = 0; i < files.length; i += 1) {
            f = files[i];
            parentNode = getParentNode(root, f);
            qtip = f;
            node = parentNode.appendChild({
                id: f,
                qtip: qtip,
                text: f.substr(f.lastIndexOf('/') + 1),
                cls: 'file',
                leaf: true,
                editable: false,
                listeners: {
                    click: callback
                }
            });
                addThumbnail(node);
        }
    }

    /**
     * @return {undefined}
     */
    function listFilesDoneCallback() {
    }

    editButton = new Ext.Button({
        enableToggle: true,
        text: 'Editable',
        listeners: { toggle: { fn: editToggle } }
    });

    slider = new Ext.Slider({
        width: 300,
        minValue: -5,
        maxValue: 5,
        values: [0],
        listeners: { changecomplete: { fn: setZoom } }
    });

    tabpanel = new Ext.TabPanel({
        tbar: [ 'Zoom: ', slider, editButton ],
        region: 'center'
    });

    tree = new Ext.tree.TreePanel({
        title: 'Documents',
        region: 'west',
        width: 200,
        split: true,
        autoScroll: true,
        collapsible: true,
        rootVisible: false,
        enableTabScroll: true,
        defaults: {autoScroll: true},
        root: { nodeType: 'node' }
    });

    viewport = new Ext.Viewport({
        layout: 'border',
        items: [ tabpanel, tree ]
    });

    // put data in the tree
    listFiles('./DeltaXML-TC4/', /\.od[tps]$/i, listFilesCallback,
            listFilesDoneCallback);
});
