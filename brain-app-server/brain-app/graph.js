// D3 Extention
d3.selection.prototype.moveToBack = function () {
    return this.each(function () {
        var firstChild = this.parentNode.firstChild;
        if (firstChild) {
            this.parentNode.insertBefore(this, firstChild);
        }
    });
};
var CircularGraph = (function () {
    function CircularGraph(id, jDiv, dataSet, svg, svgDefs, svgGroup, d3Zoom, commonData) {
        // Node
        this.isDisplayAllNode = false;
        // Bar
        this.BAR_MAX_HEIGHT = 8; // Bar-height = Rectangle width
        this.BAR_WIDTH_RATIO = 40;
        this.attributeBars = [];
        this.numBars = 0;
        this.numBarsActive = 0;
        this.circularBarColorChange = false;
        this.circularBarWidthChange = false;
        this.CIRCULAR_LINK_HILIGHT_COLOR = "#d62728";
        this.CIRCULAR_LINK_DEFAULT_COLOR = "#3498db";
        this.circularMouseDownEventListenerAdded = false;
        this.id = id;
        this.jDiv = jDiv;
        this.dataSet = dataSet;
        this.svg = svg;
        this.svgDefs = svgDefs;
        this.svgAllElements = svgGroup;
        this.d3Zoom = d3Zoom;
        this.commonData = commonData;
        this.circularBundleAttribute = "none";
        this.circularSortAttribute = "none";
        this.circularLableAttribute = "label";
    }
    CircularGraph.prototype.setDataSet = function (dataSet) {
        this.dataSet = dataSet;
    };
    CircularGraph.prototype.setColaGraph = function (colaGraph) {
        this.colaGraph = colaGraph;
    };
    CircularGraph.prototype.clear = function () {
        var nodeBundle = this.svgAllElements.selectAll(".nodeCircular").data(new Array());
        var linkBundle = this.svgAllElements.selectAll(".linkCircular").data(new Array());
        var nodeDotBundle = this.svgAllElements.selectAll(".nodeDotCircular").data(new Array());
        // Loop through and clear all existing bar.
        for (var barIndex in this.attributeBars) {
            var b = this.attributeBars[barIndex];
            var bar = this.svgAllElements.selectAll(".rect" + b.id + "Circular").data(new Array());
            bar.exit().remove();
        }
        nodeDotBundle.exit().remove();
        nodeBundle.exit().remove();
        linkBundle.exit().remove();
    };
    // Define UI components of the settings 
    CircularGraph.prototype.setupOptionMenuUI = function () {
        var _this = this;
        // Remove existing html elements
        this.circularDotCSSClass = ".network-type-appended-element-" + this.id;
        this.circularCSSClass = "network-type-appended-element-" + this.id;
        $("label").remove(this.circularDotCSSClass);
        $("select").remove(this.circularDotCSSClass);
        $("button").remove(this.circularDotCSSClass);
        $("div").remove(this.circularDotCSSClass);
        // Default Setting
        this.circularEdgeColorMode = "none";
        this.circularEdgeDirectionMode = "none";
        // Function variables response to changes in settings
        var varCircularLayoutLabelOnChange = function (s) { _this.circularLayoutLabelOnChange(s); };
        var varCircularLayoutAttributeOneOnChange = function (barID, s) { _this.circularLayoutAttributeOnChange(barID, s); };
        var varCircularLayoutSortOnChange = function (s) { _this.circularLayoutSortOnChange(s); };
        var varCircularLayoutBundleOnChange = function (s) { _this.circularLayoutBundleOnChange(s); };
        var varCircularLayoutHistogramButtonOnClick = function () { _this.circularLayoutHistogramButtonOnClick(); };
        var varCircularAddMoreButtonOnClick = function () { _this.addAttributeBar(); };
        var varCircularDisplayAllNodeOnCheck = function (isChecked) {
            _this.isDisplayAllNode = isChecked;
            _this.clear();
            _this.create();
        };
        // Setting Options
        // option button
        this.jDiv.append($('<button id="button-circular-layout-histogram-' + this.id + '" class="' + this.circularCSSClass + ' btn  btn-sm btn-primary">Options</button>')
            .css({ 'margin-left': '5px', 'font-size': '12px', 'z-index': 1000 })
            .click(function () { varCircularLayoutHistogramButtonOnClick(); }));
        //------------------------------------------------------------------------
        // menu
        this.jDiv.append($('<div id="div-circular-layout-menu-' + this.id + '" class=' + this.circularCSSClass + '></div>')
            .css({
            'display': 'none',
            'background-color': '#feeebd',
            'position': 'absolute',
            'padding': '8px',
            'border-radius': '5px'
        }));
        //------------------------------------------------------------------------
        // menu - bundle
        $('#div-circular-layout-menu-' + this.id).append($('<input type="checkbox" id="checkbox-circular-layout-display-all-' + this.id + '" class=' + this.circularCSSClass + '>')
            .css({ 'width': '20px' })
            .on("change", function () { varCircularDisplayAllNodeOnCheck($(this).is(":checked")); }));
        $('#div-circular-layout-menu-' + this.id).append('Display All Nodes');
        $('#div-circular-layout-menu-' + this.id).append('<div id="div-circular-bundle-' + this.id + '">bundle: </div>');
        $('#div-circular-bundle-' + this.id).append($('<select id="select-circular-layout-bundle-' + this.id + '" class=' + this.circularCSSClass + '></select>')
            .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () { varCircularLayoutBundleOnChange($(this).val()); }));
        $('#select-circular-layout-bundle-' + this.id).empty();
        var option = document.createElement('option');
        option.text = 'none';
        option.value = 'none';
        $('#select-circular-layout-bundle-' + this.id).append(option);
        for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
            var columnName = this.dataSet.attributes.columnNames[i];
            $('#select-circular-layout-bundle-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');
        }
        //------------------------------------------------------------------------
        // menu - sort
        $('#div-circular-layout-menu-' + this.id).append('<div id="div-circular-sort-' + this.id + '">sort: </div>');
        $('#div-circular-sort-' + this.id).append($('<select id="select-circular-layout-sort-' + this.id + '" class=' + this.circularCSSClass + '></select>')
            .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () { varCircularLayoutSortOnChange($(this).val()); }));
        $('#select-circular-layout-sort-' + this.id).empty();
        var option = document.createElement('option');
        option.text = 'none';
        option.value = 'none';
        $('#select-circular-layout-sort-' + this.id).append(option);
        for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
            var columnName = this.dataSet.attributes.columnNames[i];
            $('#select-circular-layout-sort-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');
        }
        //------------------------------------------------------------------------
        // menu - label
        $('#div-circular-layout-menu-' + this.id).append('<div id="div-circular-label-' + this.id + '">label: </div>');
        $('#div-circular-label-' + this.id).append($('<select id="select-circular-label-' + this.id + '" class=' + this.circularCSSClass + '></select>')
            .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () { varCircularLayoutLabelOnChange($(this).val()); }));
        $('#select-circular-label-' + this.id).empty();
        // If Label exists use it as default 
        var option;
        if (this.dataSet.brainLabels) {
            option = document.createElement('option');
            option.text = 'Label';
            option.value = 'label';
            $('#select-circular-label-' + this.id).append(option);
        }
        option = document.createElement('option');
        option.text = 'ID';
        option.value = 'id';
        $('#select-circular-label-' + this.id).append(option);
        for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
            var columnName = this.dataSet.attributes.columnNames[i];
            $('#select-circular-label-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');
        }
        //------------------------------------------------------------------------
        // menu - histogram
        $('#div-circular-layout-menu-' + this.id).append('<div>histogram:</div>');
        $('#div-circular-layout-menu-' + this.id).append($('<button id="button-circular-add-bar-' + this.id + '" class=' + this.circularCSSClass + '>Add More</button>')
            .css({ 'margin-left': '5px', 'font-size': '12px' })
            .click(function () { varCircularAddMoreButtonOnClick(); }));
        //---
        //$('#select-circular-layout-attribute-two-' + this.id).prop('disabled', true);
        var varClass = this.circularCSSClass;
        if (this.circularMouseDownEventListenerAdded == false) {
            this.circularMouseDownEventListenerAdded = true;
            document.addEventListener('mouseup', function (event) {
                if ((!$(event.target).hasClass(varClass)) &&
                    ((event.target).id != "input-circular-layout-bar1-color") &&
                    ((event.target).id != "input-circular-layout-bar2-color") &&
                    (_this.circularBarColorChange == false)) {
                    $('#div-circular-layout-menu-' + _this.id).hide();
                }
                _this.circularBarColorChange = false;
            }, false);
        }
    };
    CircularGraph.prototype.toggleDirectionArrow = function (isShown) {
        if (isShown) {
            this.svgAllElements.selectAll(".linkCircular")
                .style("marker-mid", "url(#arrowhead-circular)");
        }
        else {
            this.svgAllElements.selectAll(".linkCircular")
                .style("marker-mid", "none");
        }
    };
    CircularGraph.prototype.create = function () {
        if (!this.colaGraph) {
            console.log("ERROR: colaGraph is NULL");
            return;
        }
        // Get all values
        var attrLabel = $('#select-circular-label-' + this.id).val();
        var attrBundle = $('#select-circular-layout-bundle-' + this.id).val();
        var attrSort = $('#select-circular-layout-sort-' + this.id).val();
        this.generateCircularData(attrBundle);
        this.GenerateCircularUI(attrSort, attrBundle);
        this.circularLayoutLabelOnChange(attrLabel);
        this.updateAllAttributeBars();
    };
    CircularGraph.prototype.update = function () {
        if (!this.colaGraph) {
            return;
        }
        var attrSort = $('#select-circular-layout-sort-' + this.id).val();
        var attrBundle = $('#select-circular-layout-bundle-' + this.id).val();
        //------------------------------------------------------------------------------------------------
        // Update Nodes and edges data
        // update color of the nodes
        for (var nodeIndex in this.svgNodeBundleArray) {
            var node = this.svgNodeBundleArray[nodeIndex];
            node.color = this.colaGraph.nodeMeshes[node.id].material.color.getHexString();
        }
        // update edges data
        if (this.circularEdgeColorMode !== "node") {
            for (var i = 0; i < this.colaGraph.edgeList.length; i++) {
                var edge = this.colaGraph.edgeList[i];
                // If edge is visible
                if (edge.visible) {
                    // for every node in the array
                    for (var j = 0; j < this.svgNodeBundleArray.length; j++) {
                        // If this node is the source of the link
                        if (this.svgNodeBundleArray[j].id == edge.sourceNode.id) {
                            this.svgNodeBundleArray[j].linkColors[edge.targetNode.id] = edge.color;
                        }
                        // If this node is the Target of the link
                        if (this.svgNodeBundleArray[j].id == edge.targetNode.id) {
                            this.svgNodeBundleArray[j].linkColors[edge.sourceNode.id] = edge.color;
                        }
                    }
                }
            }
        }
        //------------------------------------------------------------------------------------------------
        // Generate updated data
        var nodeJson = JSON.parse(JSON.stringify(this.svgNodeBundleArray));
        var bundle = d3.layout.bundle();
        var diameter = 800, radius = diameter / 2, innerRadius = radius - 120;
        // Node pie chart
        var pie = d3.layout.pie();
        var dot = d3.svg.arc()
            .innerRadius(0)
            .outerRadius(5);
        var cluster;
        cluster = d3.layout.cluster()
            .size([360, innerRadius])
            .sort(null)
            .value(function (d) { return d.size; });
        var tree = packages.root(nodeJson);
        if (attrSort !== "none") {
            var groups = tree.children[0].children;
            if (attrBundle !== "none") {
                for (var i = 0; i < groups.length; i++) {
                    groups[i].children.sort(function (a, b) {
                        return a[attrSort][0] - b[attrSort][0];
                    });
                }
            }
            else {
                for (var i = 0; i < groups.length; i++) {
                    groups.sort(function (a, b) {
                        return a[attrSort][0] - b[attrSort][0];
                    });
                }
            }
        }
        this.nodes = cluster.nodes(tree);
        this.links = packages.imports(this.nodes);
        //-------------------------------------------------------------------------------------------
        // update UI
        var links = this.links;
        var edgeColorMode = this.circularEdgeColorMode;
        var edgeDirectionMode = this.circularEdgeDirectionMode;
        var varSvg = this.svg[0];
        var varNS = varSvg[0].namespaceURI;
        var varDefs = this.svgDefs;
        // use normal color updating style
        this.svgAllElements.selectAll(".linkCircular")
            .data(function () {
            var bundledLinks = bundle(links);
            if (bundledLinks[0][0].bundleByAttribute == "none") {
                for (var i = 0; i < bundledLinks.length; i++) {
                    bundledLinks[i][1].y = 70;
                }
            }
            return bundledLinks;
        })
            .each(function (d) { d.source = d[0], d.target = d[d.length - 1]; })
            .style("stroke-opacity", 1);
        this.svgAllElements.selectAll(".linkCircular")
            .style("stroke", function (l) {
            var id = 'gradient_' + l.source.id + '_' + l.target.id;
            var sourceOpacity = 1, targetOpacity = 1;
            if (edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode != "node") {
                return l.color = l.source.linkColors[l.target.id];
            }
            else if (l.source.color === l.target.color && edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode === "node") {
                return l.color = "#" + l.source.color;
            }
            if (edgeDirectionMode === "gradient") {
                var sourceColor = (String)(saveObj.edgeSettings.directionStartColor);
                var targetColor = (String)(saveObj.edgeSettings.directionEndColor);
            }
            else if (edgeColorMode === "node") {
                var sourceColor = String(l.source.color);
                var targetColor = String(l.target.color);
            }
            else {
                var sourceColor = String(l.source.linkColors[l.target.id]);
                var targetColor = String(l.source.linkColors[l.target.id]);
            }
            if (edgeDirectionMode === "opacity") {
                sourceOpacity = 0;
                targetOpacity = 1;
            }
            var sourceColorRGBA = CommonUtilities.hexToRgb(sourceColor, sourceOpacity).toString();
            var targetColorRGBA = CommonUtilities.hexToRgb(targetColor, targetOpacity).toString();
            var stops = [
                { offset: '0%', 'stop-color': sourceColorRGBA },
                { offset: '100%', 'stop-color': targetColorRGBA }
            ];
            // Calculate Gradient Direction
            var start = this.getPointAtLength(0);
            var end = this.getPointAtLength(this.getTotalLength());
            var box = this.getBBox();
            var x1 = ((start.x - box.x) / box.width) * 100 + "%";
            var x2 = ((end.x - box.x) / box.width) * 100 + "%";
            var y1 = ((start.y - box.y) / box.height) * 100 + "%";
            var y2 = ((end.y - box.y) / box.height) * 100 + "%";
            if ($("#" + id)[0])
                $("#" + id)[0]["remove"]();
            var grad = document.createElementNS(varNS, 'linearGradient');
            grad.setAttribute('id', id);
            grad.setAttribute('x1', x1);
            grad.setAttribute('x2', x2);
            grad.setAttribute('y1', y1);
            grad.setAttribute('y2', y2);
            for (var i = 0; i < stops.length; i++) {
                var attrs = stops[i];
                var stop = document.createElementNS(varNS, 'stop');
                for (var attr in attrs) {
                    if (attrs.hasOwnProperty(attr))
                        stop.setAttribute(attr, attrs[attr]);
                }
                grad.appendChild(stop);
            }
            varDefs.appendChild(grad);
            var gID = 'url(#' + id + ')';
            l['gradientID'] = gID;
            l.color = gID;
            return l.color;
        });
        this.toggleDirectionArrow(edgeDirectionMode === "arrow");
        // Add Nodes' id to Circular Graph
        this.svgAllElements.selectAll(".nodeCircular")
            .data(this.nodes.filter(function (n) { return !n.children; }));
        // Add Nodes' id to Circular Graph
        this.svgAllElements.selectAll(".nodeDotCircular")
            .data(this.nodes.filter(function (n) { return !n.children; }))
            .each(function (chartData, i) {
            var colorAttr = saveObj.nodeSettings.nodeColorAttribute;
            var attrArray = dataSet.attributes.get(colorAttr);
            var group = d3.select(this);
            group.selectAll("path").remove();
            if (colorAttr === "" || colorAttr === "none") {
                group.selectAll(".path")
                    .data(pie([1]))
                    .enter().append('path')
                    .attr("fill", function (d, i) { return "#d3d3d3"; })
                    .attr("d", dot);
                return;
            }
            if (saveObj.nodeSettings.nodeColorMode === "discrete") {
                var distincts = dataSet.attributes.info[colorAttr].distinctValues;
                var colorMap = d3.scale.ordinal().domain(distincts).range(saveObj.nodeSettings.nodeColorDiscrete);
            }
            else {
                var columnIndex = dataSet.attributes.columnNames.indexOf(colorAttr);
                var min = dataSet.attributes.getMin(columnIndex);
                var max = dataSet.attributes.getMax(columnIndex);
                var minColor = saveObj.nodeSettings.nodeColorContinuousMin;
                var maxColor = saveObj.nodeSettings.nodeColorContinuousMax;
                var colorMap = d3.scale.linear().domain([min, max]).range([minColor, maxColor]);
            }
            if (dataSet.attributes.info[colorAttr].numElements === 1) {
                var color = chartData[colorAttr].map(function (val) {
                    return colorMap(val).replace("0x", "#");
                });
            }
            else {
                var color = chartData[colorAttr].map(function (val, i) {
                    return colorMap(i).replace("0x", "#");
                });
            }
            group.selectAll(".path")
                .data(function () {
                var tmp = chartData[colorAttr].map(function (val) { return val; });
                if (tmp.length === 1 && tmp[0] === 0) {
                    return pie([1]);
                }
                else {
                    return pie(tmp);
                }
            }).enter().append('path')
                .attr("fill", function (d, i) { return color[i]; })
                .style("stroke-width", 0)
                .attr("d", dot);
        });
        for (var barIndex in this.attributeBars) {
            var bar = this.attributeBars[barIndex];
            this.svgAllElements.selectAll(".rect" + bar.id + "Circular")
                .data(this.nodes.filter(function (n) { return !n.children; }));
        }
    };
    // Generate data array for the graph 
    CircularGraph.prototype.generateCircularData = function (bundleByAttribute) {
        if (!this.colaGraph) {
            console.log("ERROR: colaGraph is NULL");
            return;
        }
        this.svgNodeBundleArray = [];
        var children = this.colaGraph.nodeMeshes; // TODO: Need to be replaced with other objects!!
        // Loop through all nodes of the Cola Graph
        for (var i = 0; i < children.length; i++) {
            var obj = children[i];
            if (obj.isNode) {
                if (!this.isDisplayAllNode && !obj.hasVisibleEdges)
                    continue;
                // Create new empty node
                var nodeObject = new Object();
                nodeObject["id"] = obj.id; // id
                if (this.dataSet.brainLabels) {
                    nodeObject["label"] = this.dataSet.brainLabels[obj.id];
                }
                // for every attributes
                for (var j = 0; j < this.dataSet.attributes.columnNames.length; j++) {
                    var colname = this.dataSet.attributes.columnNames[j];
                    var value = this.dataSet.attributes.get(colname)[obj.id];
                    nodeObject[colname] = value;
                    // add a special property for module id
                    if (colname == 'module_id') {
                        nodeObject['moduleID'] = this.dataSet.attributes.get(colname)[obj.id];
                    }
                    //  Get domain of the attributes (assume all positive numbers in the array)
                    var columnIndex = this.dataSet.attributes.columnNames.indexOf(colname);
                    var min = this.dataSet.attributes.getMin(columnIndex);
                    var max = this.dataSet.attributes.getMax(columnIndex);
                    // Scale value to between 0.05 to 1 
                    var attrMap = d3.scale.linear().domain([min, max]).range([0.05, 1]);
                    var scalevalue = attrMap(Math.max.apply(Math, value));
                    nodeObject['scale_' + colname] = scalevalue;
                    if (this.dataSet.attributes.info[colname].isDiscrete) {
                        // Scale to group attirbutes 
                        var values = this.dataSet.attributes.info[colname].distinctValues;
                        nodeObject['bundle_group_' + colname] = values.indexOf(Math.max.apply(Math, value));
                    }
                    else {
                        // Scale to group attirbutes 
                        var bundleGroupMap = d3.scale.linear().domain([min, max]).range([0, 9.99]); // use 9.99 instead of 10 to avoid a group of a single element (that has the max attribute value)
                        var bundleGroup = bundleGroupMap(Math.max.apply(Math, value)); // group
                        bundleGroup = Math.floor(bundleGroup);
                        nodeObject['bundle_group_' + colname] = bundleGroup;
                    }
                }
                nodeObject["bundleByAttribute"] = bundleByAttribute;
                if (bundleByAttribute == "none") {
                    //nodeObject["name"] = "root.module" + nodeObject['moduleID'] + "." + obj.id;
                    nodeObject["name"] = "root." + obj.id;
                }
                else {
                    nodeObject["name"] = "root." + bundleByAttribute + nodeObject['bundle_group_' + bundleByAttribute] + "." + obj.id;
                }
                nodeObject["color"] = this.colaGraph.nodeMeshes[obj.id].material.color.getHexString();
                // Declare variables 
                nodeObject["imports"] = [];
                nodeObject["linkColors"] = [];
                nodeObject["barWidths"] = []; // used to calculate the position of the label for each bar
                this.svgNodeBundleArray.push(nodeObject);
            }
        }
        // sort Node objects according the bundled attribute values
        if (bundleByAttribute !== "none") {
            this.svgNodeBundleArray.sort(function (a, b) {
                return Math.max(a[bundleByAttribute][0]) - Math.max(b[bundleByAttribute][0]);
            });
        }
        // loop through all edges of the Cola Graph
        for (var i = 0; i < this.colaGraph.edgeList.length; i++) {
            var edge = this.colaGraph.edgeList[i];
            // If edge is visible
            if (edge.visible) {
                // for every node in the array
                for (var j = 0; j < this.svgNodeBundleArray.length; j++) {
                    // If this node is the source of the link
                    if (this.svgNodeBundleArray[j].id == edge.sourceNode.id) {
                        var moduleID = -1;
                        var bundleGroupID = -1;
                        // for every node in the array again (to find the target node of this link)
                        for (var k = 0; k < this.svgNodeBundleArray.length; k++) {
                            if (this.svgNodeBundleArray[k].id == edge.targetNode.id) {
                                if (bundleByAttribute == "none") {
                                    moduleID = this.svgNodeBundleArray[k].moduleID;
                                    var nodeName = "root." + edge.targetNode.id;
                                }
                                else {
                                    bundleGroupID = this.svgNodeBundleArray[k]['bundle_group_' + bundleByAttribute];
                                    var nodeName = "root." + bundleByAttribute + bundleGroupID + "." + edge.targetNode.id;
                                }
                                this.svgNodeBundleArray[j].imports.push(nodeName); // add target nodes to this node
                                this.svgNodeBundleArray[j].linkColors[edge.targetNode.id] = edge.color;
                                break;
                            }
                        }
                    }
                }
            }
        }
    };
    CircularGraph.prototype.GenerateCircularUI = function (sortByAttribute, bundleByAttribute) {
        var _this = this;
        var nodeJson = JSON.parse(JSON.stringify(this.svgNodeBundleArray));
        var width = 250 + this.jDiv.width() / 2;
        var height = (this.jDiv.height() - sliderSpace) / 2;
        var diameter = 800, radius = diameter / 2, innerRadius = radius - 120;
        var cluster;
        cluster = d3.layout.cluster()
            .size([360, innerRadius])
            .sort(null) // Using built-in D3 sort destroy the order of the cluster => need to be investigated
            .value(function (d) {
            return 180;
        });
        var bundle = d3.layout.bundle();
        // Node pie chart
        var pie = d3.layout.pie();
        var dot = d3.svg.arc()
            .innerRadius(0)
            .outerRadius(5);
        // Link path
        var line = d3.svg.line.radial()
            .tension(.85)
            .radius(function (d) {
            return d.y;
        })
            .interpolate("bundle")
            .angle(function (d) { return d.x / 180 * Math.PI; });
        this.svgAllElements.attr("transform", "translate(" + width + "," + height + ")");
        this.d3Zoom.scale(1);
        this.d3Zoom.translate([width, height]);
        // An alternative solutions to sorting the children while keeping 
        // the order of the clusters 
        var tree = packages.root(nodeJson);
        if (sortByAttribute !== "none") {
            var groups = tree.children[0].children;
            // If  bundle is none, the children are not put into groups
            if (bundleByAttribute !== "none") {
                for (var i = 0; i < groups.length; i++) {
                    groups[i].children.sort(function (a, b) {
                        return Math.max(a[sortByAttribute][0]) - Math.max(b[sortByAttribute][0]);
                    });
                }
            }
            else {
                for (var i = 0; i < groups.length; i++) {
                    groups.sort(function (a, b) {
                        return Math.max(a[sortByAttribute][0]) - Math.max(b[sortByAttribute][0]);
                    });
                }
            }
        }
        this.nodes = cluster.nodes(tree);
        this.links = packages.imports(this.nodes);
        var varMouseOveredSetNodeID = function (id) { _this.mouseOveredSetNodeID(id); };
        var varMouseOutedSetNodeID = function () { _this.mouseOutedSetNodeID(); };
        var varMouseOveredCircularLayout = function (d) { _this.mouseOveredCircularLayout(d); };
        var varMouseOutedCircularLayout = function (d) { _this.mouseOutedCircularLayout(d); };
        ////////////////////////////////////////////////////////////////////////////
        ///////////// Adding Elements to SVG to create Cicular Graph ///////////////
        ////////////////////////////////////////////////////////////////////////////
        // Add Links to Circular Graph
        var links = this.links;
        var edgeColorMode = this.circularEdgeColorMode;
        var edgeDirectionMode = this.circularEdgeDirectionMode;
        var varSvg = this.svg[0];
        var varNS = varSvg[0].namespaceURI;
        var varDefs = this.svgDefs;
        this.svgAllElements.selectAll(".linkCircular")
            .data(function () {
            var bundledLinks = bundle(links);
            if (bundledLinks[0][0].bundleByAttribute == "none") {
                for (var i = 0; i < bundledLinks.length; i++) {
                    bundledLinks[i][1].y = 70;
                }
            }
            return bundledLinks;
        })
            .enter()
            .append("path") // Appending Element
            .each(function (d) { d.source = d[0], d.target = d[d.length - 1]; })
            .attr("class", "linkCircular")
            .attr("d", function (d) {
            return line(d);
        })
            .style("stroke-opacity", 1)
            .style("stroke", function (l) {
            var id = 'gradient_' + l.source.id + '_' + l.target.id;
            var sourceOpacity = 1, targetOpacity = 1;
            if (edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode != "node") {
                return l.color = l.source.linkColors[l.target.id];
            }
            else if (l.source.color === l.target.color && edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode === "node") {
                return l.color = "#" + l.source.color;
            }
            if (edgeDirectionMode === "gradient") {
                var sourceColor = (String)(saveObj.edgeSettings.directionStartColor);
                var targetColor = (String)(saveObj.edgeSettings.directionEndColor);
            }
            else if (edgeColorMode === "node") {
                var sourceColor = String(l.source.color);
                var targetColor = String(l.target.color);
            }
            else {
                var sourceColor = String(l.source.linkColors[l.target.id]);
                var targetColor = String(l.source.linkColors[l.target.id]);
            }
            if (edgeDirectionMode === "opacity") {
                sourceOpacity = 0;
                targetOpacity = 1;
            }
            var sourceColorRGBA = CommonUtilities.hexToRgb(sourceColor, sourceOpacity).toString();
            var targetColorRGBA = CommonUtilities.hexToRgb(targetColor, targetOpacity).toString();
            var stops = [
                { offset: '0%', 'stop-color': sourceColorRGBA },
                { offset: '100%', 'stop-color': targetColorRGBA }
            ];
            // Calculate Gradient Direction
            var start = this.getPointAtLength(0);
            var end = this.getPointAtLength(this.getTotalLength());
            var box = this.getBBox();
            var x1 = ((start.x - box.x) / box.width) * 100 + "%";
            var x2 = ((end.x - box.x) / box.width) * 100 + "%";
            var y1 = ((start.y - box.y) / box.height) * 100 + "%";
            var y2 = ((end.y - box.y) / box.height) * 100 + "%";
            if ($("#" + id)[0])
                $("#" + id)[0]["remove"]();
            var grad = document.createElementNS(varNS, 'linearGradient');
            grad.setAttribute('id', id);
            grad.setAttribute('x1', x1);
            grad.setAttribute('x2', x2);
            grad.setAttribute('y1', y1);
            grad.setAttribute('y2', y2);
            for (var i = 0; i < stops.length; i++) {
                var attrs = stops[i];
                var stop = document.createElementNS(varNS, 'stop');
                for (var attr in attrs) {
                    if (attrs.hasOwnProperty(attr))
                        stop.setAttribute(attr, attrs[attr]);
                }
                grad.appendChild(stop);
            }
            varDefs.appendChild(grad);
            var gID = 'url(#' + id + ')';
            l['gradientID'] = gID;
            l.color = gID;
            return l.color;
        });
        // Add Nodes' id to Circular Graph
        this.svgAllElements.selectAll(".nodeCircular")
            .data(this.nodes.filter(function (n) {
            return !n.children;
        }))
            .enter()
            .append("text") // Appending Element
            .attr("class", "nodeCircular")
            .attr("dy", ".31em")
            .attr("transform", function (d) { return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 16) + ",0)" + (d.x < 180 ? "" : "rotate(180)"); })
            .style("text-anchor", function (d) { return d.x < 180 ? "start" : "end"; })
            .text(function (d) { return d.key; })
            .on("mouseover", function (d) { varMouseOveredCircularLayout(d); varMouseOveredSetNodeID(d.id); })
            .on("mouseout", function (d) { varMouseOutedCircularLayout(d); varMouseOutedSetNodeID(); });
        // Add Nodes' id to Circular Graph
        this.svgAllElements.selectAll(".nodeDotCircular")
            .data(this.nodes.filter(function (n) { return !n.children; }))
            .enter()
            .append("g") // Appending Element
            .attr("class", "nodeDotCircular")
            .attr("transform", function (d) {
            return "rotate(" + (d.x - 90) + ")translate(" + (d.y) + ",0)" + (d.x < 180 ? "" : "rotate(180)");
        })
            .on("mouseover", function (d) { varMouseOveredCircularLayout(d); varMouseOveredSetNodeID(d.id); })
            .on("mouseout", function (d) { varMouseOutedCircularLayout(d); varMouseOutedSetNodeID(); })
            .each(function (chartData, i) {
            var colorAttr = saveObj.nodeSettings.nodeColorAttribute;
            var attrArray = dataSet.attributes.get(colorAttr);
            var group = d3.select(this);
            group.selectAll("path").remove();
            if (colorAttr === "" || colorAttr === "none") {
                group.selectAll(".path")
                    .data(pie([1]))
                    .enter().append('path')
                    .attr("fill", function (d, i) { return "#d3d3d3"; })
                    .attr("d", dot);
                return;
            }
            else {
                if (saveObj.nodeSettings.nodeColorMode === "discrete") {
                    var distincts = dataSet.attributes.info[colorAttr].distinctValues;
                    var colorMap = d3.scale.ordinal().domain(distincts).range(saveObj.nodeSettings.nodeColorDiscrete);
                }
                else {
                    var columnIndex = dataSet.attributes.columnNames.indexOf(colorAttr);
                    var min = dataSet.attributes.getMin(columnIndex);
                    var max = dataSet.attributes.getMax(columnIndex);
                    var minColor = saveObj.nodeSettings.nodeColorContinuousMin;
                    var maxColor = saveObj.nodeSettings.nodeColorContinuousMax;
                    var colorMap = d3.scale.linear().domain([min, max]).range([minColor, maxColor]);
                }
                if (dataSet.attributes.info[colorAttr].numElements === 1) {
                    var color = chartData[colorAttr].map(function (val) {
                        return colorMap(val).replace("0x", "#");
                    });
                }
                else {
                    var color = chartData[colorAttr].map(function (val, i) {
                        return colorMap(i).replace("0x", "#");
                    });
                }
                group.selectAll(".path")
                    .data(function () {
                    var tmp = chartData[colorAttr].map(function (val) { return val; });
                    if (tmp.length === 1 && tmp[0] === 0) {
                        return pie([1]);
                    }
                    else {
                        return pie(tmp);
                    }
                })
                    .enter().append('path')
                    .attr("fill", function (d, i) {
                    return color[i];
                })
                    .style("stroke-width", 0)
                    .attr("d", dot);
            }
        });
        for (var barIndex in this.attributeBars) {
            var bar = this.attributeBars[barIndex];
            this.svgAllElements.selectAll(".rect" + bar.id + "Circular")
                .data(this.nodes.filter(function (n) { return !n.children; }))
                .enter()
                .append("rect")
                .attr("class", "rect" + bar.id + "Circular")
                .on("mouseover", function (d) { varMouseOveredCircularLayout(d); varMouseOveredSetNodeID(d.id); })
                .on("mouseout", function (d) { varMouseOutedCircularLayout(d); varMouseOutedSetNodeID(); });
        }
        d3.select(window.frameElement).style("height", diameter + "px");
    };
    CircularGraph.prototype.addAttributeBar = function () {
        var _this = this;
        var varMouseOveredSetNodeID = function (id) { _this.mouseOveredSetNodeID(id); };
        var varMouseOutedSetNodeID = function () { _this.mouseOutedSetNodeID(); };
        var varMouseOveredCircularLayout = function (d) { _this.mouseOveredCircularLayout(d); };
        var varMouseOutedCircularLayout = function (d) { _this.mouseOutedCircularLayout(d); };
        var varCircularLayoutAttributeOnChange = function (barID, val) { _this.circularLayoutAttributeOnChange(barID, val); };
        var varUpdateCircularBarColor = function (barID, color) { _this.updateCircularBarColor(barID, color); };
        var id = this.attributeBars.length;
        var bar = {
            id: id,
            color: "#bdc3c7",
            attribute: "none",
            isGradientOn: false
        };
        this.attributeBars.push(bar);
        this.numBars += 1;
        // Add New Bar to Circular Graph
        this.svgAllElements.selectAll(".rect" + bar.id + "Circular")
            .data(this.nodes.filter(function (n) {
            return !n.children;
        }))
            .enter().append("rect")
            .attr("class", "rect" + bar.id + "Circular")
            .on("mouseover", function (d) { varMouseOveredCircularLayout(d); varMouseOveredSetNodeID(d.id); })
            .on("mouseout", function (d) { varMouseOutedCircularLayout(d); varMouseOutedSetNodeID(); });
        // Rearange the menu layout
        var l = $('#button-circular-layout-histogram-' + this.id).position().left + 5;
        var t = $('#button-circular-layout-histogram-' + this.id).position().top - $('#div-circular-layout-menu-' + this.id).height() - 15;
        $('#div-circular-layout-menu-' + this.id).zIndex(1000);
        $('#div-circular-layout-menu-' + this.id).css({ left: l, top: t, height: 'auto' });
        //------------------------------------------------------------------------------------------------------------
        // Add control options for new bar
        $('#div-circular-layout-menu-' + this.id).append('<div id="div-circular-bar' + bar.id + '-' + this.id + '"></div>');
        $('#div-circular-bar' + bar.id + '-' + this.id).append($('<select id="select-circular-layout-attribute-' + bar.id + '-' + this.id + '" class=' + this.circularCSSClass + '></select>')
            .css({ 'margin-left': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () {
            varCircularLayoutAttributeOnChange(bar.id, $(this).val());
        }));
        $('#div-circular-bar' + bar.id + '-' + this.id).append($('<input id="input-circular-layout-bar' + bar.id + '-color" class=' + this.circularCSSClass + '>')
            .attr("value", "bdc3c7")
            .css({ 'width': '80px', 'background-color': '#feeebd', 'border': '1px solid grey' })
            .on("change", function () {
            varUpdateCircularBarColor(bar.id, "#" + this.value);
        }));
        var myPicker = new jscolor.color(document.getElementById('input-circular-layout-bar' + bar.id + '-color'), {
            pickerFace: 3,
            pickerFaceColor: '#feeebd',
            styleElement: 'input-circular-layout-bar' + bar.id + '-color'
        });
        $('#select-circular-layout-attribute-' + bar.id + '-' + this.id).empty();
        var option = document.createElement('option');
        option.text = 'none';
        option.value = 'none';
        $('#select-circular-layout-attribute-' + bar.id + '-' + this.id).append(option);
        for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
            var columnName = this.dataSet.attributes.columnNames[i];
            $('#select-circular-layout-attribute-' + bar.id + '-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');
        }
    };
    // Differences between update and set circular bar color
    CircularGraph.prototype.updateCircularBarColor = function (barID, color) {
        this.circularBarColorChange = true;
        // update bar object
        var bar = this.attributeBars[barID];
        bar.color = color;
        var gScale = 100;
        var r, g, b;
        var txt;
        var rgbtext;
        var delta;
        //var varLightenColor = (rgb: string, delta: number) => { this.lightenColor(rgb, delta); };
        if (bar.isGradientOn) {
            var attr = $('#select-circular-layout-attribute-' + bar.id + '-' + this.id).val();
            // Change all color of the first bar
            this.svgAllElements.selectAll(".rect" + bar.id + "Circular")
                .style("fill", function (d) {
                delta = gScale * (1 - d["scale_" + attr]);
                rgbtext = rgbtext.replace("#", "");
                delta = Math.floor(delta);
                r = parseInt(rgbtext.substr(0, 2), 16),
                    g = parseInt(rgbtext.substr(2, 2), 16),
                    b = parseInt(rgbtext.substr(4, 2), 16),
                    r += delta;
                if (r > 255)
                    r = 255;
                if (r < 0)
                    r = 0;
                g += delta;
                if (g > 255)
                    g = 255;
                if (g < 0)
                    g = 0;
                b += delta;
                if (b > 255)
                    b = 255;
                if (b < 0)
                    b = 0;
                txt = b.toString(16);
                if (txt.length < 2)
                    txt = "0" + txt;
                txt = g.toString(16) + txt;
                if (txt.length < 4)
                    txt = "0" + txt;
                txt = r.toString(16) + txt;
                if (txt.length < 6)
                    txt = "0" + txt;
                return "#" + txt;
            });
        }
        else {
            this.svgAllElements.selectAll(".rect" + bar.id + "Circular")
                .style("fill", color);
        }
    };
    ////////////////////////////////////////////////////////////////
    ///////// Change in Graph Settings /////////////////////////////
    ////////////////////////////////////////////////////////////////
    CircularGraph.prototype.updateAllAttributeBars = function () {
        var height = this.BAR_MAX_HEIGHT / this.numBarsActive;
        var count = 0;
        var BAR_MAX_HEIGHT = this.BAR_MAX_HEIGHT;
        for (var barIndex in this.attributeBars) {
            var b = this.attributeBars[barIndex];
            // check if the bar is active
            if (b.attribute !== "none") {
                this.svgAllElements.selectAll(".rect" + b.id + "Circular")
                    .attr("transform", function (d) {
                    return "rotate(" + (d.x - 90) + ")" +
                        "translate(" + (d.y + 4) + ",  " + ((height * count) - BAR_MAX_HEIGHT / 2) + ")" + (d.x < 180 ? "" : "");
                    // Change bar height
                }).attr("height", function (d) {
                    return height;
                }).attr("width", function (d) {
                    var barWidth = 40 * d["scale_" + b.attribute];
                    d.barWidths[b.id] = barWidth;
                    return barWidth;
                });
                this.updateCircularBarColor(b.id, b.color);
                count++;
            }
        }
        // move the label
        this.svgAllElements.selectAll(".nodeCircular")
            .attr("transform", function (d) {
            var maxSize = 0;
            for (var widthSize in d.barWidths) {
                if (maxSize < d.barWidths[widthSize]) {
                    maxSize = d.barWidths[widthSize];
                }
            }
            return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 16 + maxSize) + ",0)" + (d.x < 180 ? "" : "rotate(180)");
        });
    };
    // Change on Attribute of bar
    CircularGraph.prototype.circularLayoutAttributeOnChange = function (barID, attr) {
        var bar = this.attributeBars[barID];
        var height = this.BAR_MAX_HEIGHT / this.numBarsActive;
        var BAR_MAX_HEIGHT = this.BAR_MAX_HEIGHT;
        // update number of active bar
        if (bar.attribute == "none" && attr !== "none") {
            this.numBarsActive++;
            this.circularBarWidthChange = true;
        }
        else if (bar.attribute !== "none" && attr == "none") {
            this.numBarsActive--;
            this.circularBarWidthChange = true;
        }
        // update bar attribute
        bar.attribute = attr;
        // Update all active bar width 
        var count = 0;
        if (this.circularBarWidthChange) {
            height = this.BAR_MAX_HEIGHT / this.numBarsActive;
            for (var barIndex in this.attributeBars) {
                var b = this.attributeBars[barIndex];
                // check if the bar is active
                if (b.attribute !== "none") {
                    this.svgAllElements.selectAll(".rect" + b.id + "Circular")
                        .attr("transform", function (d) {
                        return "rotate(" + (d.x - 90) + ")" +
                            "translate(" + (d.y + 4) + ",  " + ((height * count) - BAR_MAX_HEIGHT / 2) + ")" + (d.x < 180 ? "" : "");
                        // Change bar height
                    }).attr("height", function (d) {
                        return height;
                    });
                    count++;
                }
            }
        }
        // update bar width (height) value
        if (bar.attribute !== "none") {
            this.svgAllElements.selectAll(".rect" + bar.id + "Circular")
                .attr("width", function (d) {
                var barWidth = 40 * d["scale_" + attr];
                d.barWidths[bar.id] = barWidth;
                return barWidth;
            });
        }
        else {
            this.svgAllElements.selectAll(".rect" + bar.id + "Circular")
                .attr("width", function (d) {
                d.barWidths[bar.id] = 0;
                return 0;
            });
        }
        // Update the bar color base on the value in the object
        this.updateCircularBarColor(bar.id, bar.color);
        // move the label
        this.svgAllElements.selectAll(".nodeCircular")
            .attr("transform", function (d) {
            var maxSize = 0;
            for (var widthSize in d.barWidths) {
                if (maxSize < d.barWidths[widthSize]) {
                    maxSize = d.barWidths[widthSize];
                }
            }
            return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 16 + maxSize) + ",0)" + (d.x < 180 ? "" : "rotate(180)");
        });
    };
    CircularGraph.prototype.circularLayoutSortOnChange = function (attr) {
        this.circularSortAttribute = $('#select-circular-layout-sort-' + this.id).val();
        this.clear();
        this.create(); // recreate the graph
        //this.showNetwork(true); // Is there another way to update the graph without calling this function
    };
    CircularGraph.prototype.circularLayoutBundleOnChange = function (attr) {
        this.circularBundleAttribute = $('#select-circular-layout-bundle-' + this.id).val();
        this.clear();
        this.create(); // recreate the graph
    };
    CircularGraph.prototype.circularLayoutLabelOnChange = function (attr) {
        this.circularLableAttribute = attr;
        if (attr == "label") {
            this.svgAllElements.selectAll(".nodeCircular")
                .text(function (d) {
                return d.label;
            });
        }
        else if (attr == "id") {
            this.svgAllElements.selectAll(".nodeCircular")
                .text(function (d) { return d.key; });
        }
        else {
            this.svgAllElements.selectAll(".nodeCircular")
                .text(function (d) { return d[attr]; });
        }
    };
    CircularGraph.prototype.circularLayoutEdgeColorModeOnChange = function (mode) {
        this.circularEdgeColorMode = mode;
        this.update();
    };
    CircularGraph.prototype.circularLayoutEdgeDirectionModeOnChange = function (directionMode) {
        if (this.circularEdgeDirectionMode === directionMode)
            return;
        // remove old direction mode
        if (this.circularEdgeDirectionMode === "arrow") {
            this.toggleDirectionArrow(false);
        }
        else if (this.circularEdgeDirectionMode === "ansimation") {
        }
        else if (this.circularEdgeDirectionMode === "opacity") {
        }
        // Apply new direction mode
        if (directionMode === "arrow") {
            this.toggleDirectionArrow(true);
        }
        else if (directionMode === "animation") {
        }
        else if (directionMode === "opacity") {
        }
        this.circularEdgeDirectionMode = directionMode;
        this.update();
    };
    ////////////////////////////////////////////////////////////////
    ///////// Mouse Interaction ////////////////////////////////////
    ////////////////////////////////////////////////////////////////
    CircularGraph.prototype.mouseOveredSetNodeID = function (id) {
        this.commonData.nodeIDUnderPointer[4] = id;
    };
    CircularGraph.prototype.mouseOutedSetNodeID = function () {
        this.commonData.nodeIDUnderPointer[4] = -1;
    };
    // Handle click on the Options
    CircularGraph.prototype.circularLayoutHistogramButtonOnClick = function () {
        var l = $('#button-circular-layout-histogram-' + this.id).position().left + 5;
        var t = $('#button-circular-layout-histogram-' + this.id).position().top - $('#div-circular-layout-menu-' + this.id).height() - 15;
        for (var barIndex in this.attributeBars) {
            var bar = this.attributeBars[barIndex];
            if ($('#span-circular-layout-bar' + bar.id + '-color-picker').length > 0) {
            }
        }
        $('#div-circular-layout-menu-' + this.id).zIndex(1000);
        $('#div-circular-layout-menu-' + this.id).css({ left: l, top: t, height: 'auto' });
        $('#div-circular-layout-menu-' + this.id).fadeToggle('fast');
    };
    // When the mouse hovers the node's label
    CircularGraph.prototype.mouseOveredCircularLayout = function (d) {
        var selectedID = this.commonData.selectedNode;
        // Reseting All nodes source and target
        this.svgAllElements.selectAll(".nodeCircular")
            .each(function (n) { n.target = n.source = false; }); // For every node in the graph
        var varEdgeColorMode = this.circularEdgeColorMode;
        this.svgAllElements.selectAll(".linkCircular")
            .style("stroke-width", function (l) {
            // if the link is associated with the selected node in anyway (source or target)
            if (l.target === d) {
                l.target.source = true;
                l.source.target = true;
            }
            if (l.source === d) {
                l.source.source = true;
                l.target.target = true;
            }
            if (l.source.id === selectedID) {
                l.source.source = true;
                l.target.target = true;
            }
            if (l.target.id === selectedID) {
                l.source.source = true;
                l.target.target = true;
            }
            // Reassign line width to all links base on the given information
            if (l.target === d || l.source === d || l.source.id === selectedID || l.target.id === selectedID) {
                return "3px";
            }
            else {
                return "1px";
            }
        })
            .style("stroke-opacity", function (l) {
            if (l.target === d || l.source === d || l.source.id === selectedID || l.target.id === selectedID) {
                return 1;
            }
            else {
                return 0.2;
            }
        });
        this.svgAllElements.selectAll(".nodeCircular")
            .style("font-weight", function (n) {
            if ((n.target || n.source)) {
                return "bolder";
            }
            else {
                return "normal";
            }
        })
            .style("font-size", function (n) {
            if (n.source) {
                return "17px";
            }
            else if (n.target) {
                return "13px";
            }
            else {
                return "11px";
            }
        })
            .style("opacity", function (n) {
            if (n.target || n.source) {
                return 1;
            }
            else {
                return 0.2;
            }
        });
        ;
        this.svgAllElements.selectAll(".nodeDotCircular")
            .style("opacity", function (n) {
            if (n.target || n.source) {
                return 1;
            }
            else {
                return 0.2;
            }
        });
        ;
        for (var barIndex in this.attributeBars) {
            var b = this.attributeBars[barIndex];
            // check if the bar is active
            if (b.attribute !== "none") {
                this.svgAllElements.selectAll(".rect" + b.id + "Circular")
                    .style("opacity", function (n) {
                    if (n.target || n.source) {
                        return 1;
                    }
                    else {
                        return 0.2;
                    }
                });
            }
        }
    };
    CircularGraph.prototype.mouseOutedCircularLayout = function (d) {
        //this.commonData.nodeIDUnderPointer[4] = -1;
        var selectedID = this.commonData.selectedNode;
        if (selectedID == -1) {
            this.svgAllElements.selectAll(".linkCircular")
                .style("stroke-width", "1px")
                .style("stroke-opacity", 1);
            this.svgAllElements.selectAll(".nodeCircular")
                .style("font-weight", "normal")
                .style("font-size", "11px")
                .style("opacity", 1);
            this.svgAllElements.selectAll(".nodeDotCircular")
                .style("opacity", 1);
            for (var barIndex in this.attributeBars) {
                var b = this.attributeBars[barIndex];
                // check if the bar is active
                if (b.attribute !== "none") {
                    this.svgAllElements.selectAll(".rect" + b.id + "Circular")
                        .style("opacity", 1);
                }
            }
        }
        else {
            // Reseting All nodes source and target
            this.svgAllElements.selectAll(".nodeCircular")
                .each(function (n) { n.target = n.source = false; }); // For every node in the graph
            var varEdgeColorMode = this.circularEdgeColorMode;
            this.svgAllElements.selectAll(".linkCircular")
                .style("stroke-width", function (l) {
                // if the link is associated with the selected node in anyway (source or target)
                if (l.source.id === selectedID) {
                    l.source.source = true;
                    l.target.target = true;
                }
                if (l.target.id === selectedID) {
                    l.source.source = true;
                    l.target.target = true;
                }
                // Reassign line width to all links base on the given information
                if (l.source.id == selectedID || l.target.id == selectedID) {
                    return "3px";
                }
                else {
                    return "1px";
                }
            })
                .style("stroke-opacity", function (l) {
                if (l.source.id == selectedID || l.target.id == selectedID) {
                    return 1;
                }
                else {
                    return 0.2;
                }
            });
            this.svgAllElements.selectAll(".nodeCircular")
                .style("font-weight", function (n) {
                if ((n.target || n.source)) {
                    return "bolder";
                }
                else {
                    return "normal";
                }
            })
                .style("font-size", function (n) {
                if (n.source) {
                    return "17px";
                }
                else if (n.target) {
                    return "13px";
                }
                else {
                    return "11px";
                }
            })
                .style("opacity", function (n) {
                if (n.target || n.source) {
                    return 1;
                }
                else {
                    return 0.2;
                }
            });
            ;
            this.svgAllElements.selectAll(".nodeDotCircular")
                .style("opacity", function (n) {
                if (n.target || n.source) {
                    return 1;
                }
                else {
                    return 0.2;
                }
            });
            ;
            for (var barIndex in this.attributeBars) {
                var b = this.attributeBars[barIndex];
                // check if the bar is active
                if (b.attribute !== "none") {
                    this.svgAllElements.selectAll(".rect" + b.id + "Circular")
                        .style("opacity", function (n) {
                        if (n.target || n.source) {
                            return 1;
                        }
                        else {
                            return 0.2;
                        }
                    });
                }
            }
        }
    };
    return CircularGraph;
}());
var Graph2D = (function () {
    function Graph2D(id, jDiv, dataSet, svg, svgDefs, svgGroup, d3Zoom, commonData) {
        this.groupNodesBy = "none";
        // edge 
        this.isEdgeColorChanged = false;
        this.nodes = [];
        this.links = [];
        this.svg = svg;
        this.svgDefs = svgDefs;
        this.svgAllElements = svgGroup;
        this.id = id;
        this.jDiv = jDiv;
        this.dataSet = dataSet;
        this.d3Zoom = d3Zoom;
        this.commonData = commonData;
        this.edgeLengthScale = 3;
        this.edgeBaseLength = 7;
        this.mouseDownEventListenerAdded = false;
    }
    Graph2D.prototype.toggleDirectionArrow = function (isShown) {
        if (isShown) {
            this.svgAllElements.selectAll(".link")
                .style("marker-end", "url(#arrowhead-2d)");
        }
        else {
            this.svgAllElements.selectAll(".link")
                .style("marker-end", "none");
        }
    };
    Graph2D.prototype.menuButtonOnClick = function () {
        var l = $('#button-graph2d-option-menu-' + this.id).position().left + 5;
        var t = $('#button-graph2d-option-menu-' + this.id).position().top - $('#div-graph2d-layout-menu-' + this.id).height() - 15;
        $('#div-graph2d-layout-menu-' + this.id).zIndex(1000);
        $('#div-graph2d-layout-menu-' + this.id).css({ left: l, top: t, height: 'auto' });
        $('#div-graph2d-layout-menu-' + this.id).fadeToggle('fast');
    };
    Graph2D.prototype.setupOptionMenuUI = function () {
        var _this = this;
        // Remove existing html elements
        this.graph2DDotClass = ".graph-2d-menu-" + this.id;
        this.graph2DClass = "graph-2d-menu-" + this.id;
        $("label").remove(this.graph2DDotClass);
        $("select").remove(this.graph2DDotClass);
        $("button").remove(this.graph2DDotClass);
        $("div").remove(this.graph2DDotClass);
        // Default Setting
        this.isFlowLayoutOn = false;
        // Function variables response to changes in settings
        var varLayoutOnChange = function (isOn) {
            _this.isFlowLayoutOn = isOn;
            _this.settingOnChange();
        };
        var varEdgeLengthOnChange = function () {
            var edgeLengthScale = $("#div-edge-length-slider-" + _this.id)['bootstrapSlider']().data('bootstrapSlider').getValue();
            _this.edgeLengthScale = edgeLengthScale;
            _this.settingOnChange();
        };
        var varGroupNodesOnChange = function (groupBy) {
            _this.groupNodesBy = groupBy;
            _this.settingOnChange();
        };
        var varMenuButtonOnClick = function () { _this.menuButtonOnClick(); };
        // Setting Options
        // option button
        this.jDiv.append($('<button id="button-graph2d-option-menu-' + this.id + '" class="' + this.graph2DClass + ' btn  btn-sm btn-primary">Options</button>')
            .css({ 'position': 'relative', 'margin-left': '5px', 'font-size': '12px', 'z-index': 1000 })
            .click(function () { varMenuButtonOnClick(); }));
        //------------------------------------------------------------------------
        // menu
        this.jDiv.append($('<div id="div-graph2d-layout-menu-' + this.id + '" class="' + this.graph2DClass + '"></div>')
            .css({
            'display': 'none',
            'background-color': '#feeebd',
            'position': 'absolute',
            'padding': '8px',
            'border-radius': '5px'
        }));
        //------------------------------------------------------------------------
        // menu - edge length
        $('#div-graph2d-layout-menu-' + this.id).append('<div>Edge Length<div/>');
        $('#div-graph2d-layout-menu-' + this.id).append($('<input id="div-edge-length-slider-' + this.id + '" class=' + this.graph2DClass + 'data-slider-id="surface-opacity-slider" type="text"' +
            'data-slider-min="3" data-slider-max="10" data-slider-step="0.5" data-slider-value="1" />')
            .css({ 'position': 'relative', 'width': '150px' }));
        $("#div-edge-length-slider-" + this.id)['bootstrapSlider']();
        $("#div-edge-length-slider-" + this.id)['bootstrapSlider']().on('change', varEdgeLengthOnChange);
        // menu - flow
        $('#div-graph2d-layout-menu-' + this.id).append('<div id="div-graph2d-flow-' + this.id + '"></div>');
        $('#div-graph2d-flow-' + this.id).append($('<input type="checkbox" id="checkbox-graph2d-flow-layout-' + this.id + '" class=' + this.graph2DClass + '>')
            .css({ 'position': 'relative', 'width': '20px' })
            .on("change", function () { varLayoutOnChange($(this).is(":checked")); }));
        $('#div-graph2d-flow-' + this.id).append('Enable Flow Layout');
        // menu - group nodes
        $('#div-graph2d-layout-menu-' + this.id).append('<div id="div-graph2d-group-' + this.id + '">bundle: </div>');
        $('#div-graph2d-group-' + this.id).append($('<select id="select-graph2d-group-' + this.id + '" class=' + this.graph2DClass + '></select>')
            .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () { varGroupNodesOnChange($(this).val()); }));
        $('#select-graph2d-group-' + this.id).empty();
        var option = document.createElement('option');
        option.text = 'none';
        option.value = 'none';
        $('#select-graph2d-group-' + this.id).append(option);
        // Add descrete attribute to list
        for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
            var columnName = this.dataSet.attributes.columnNames[i];
            if (this.dataSet.attributes.info[columnName].isDiscrete) {
                $('#select-graph2d-group-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');
            }
        }
        var varClass = this.graph2DClass;
        if (this.mouseDownEventListenerAdded == false) {
            this.mouseDownEventListenerAdded = true;
            document.addEventListener('mouseup', function (event) {
                if ((!$(event.target).hasClass(varClass))) {
                    $('#div-graph2d-layout-menu-' + _this.id).hide();
                }
            }, false);
        }
    };
    // Convert dataset to D3-compatible format
    Graph2D.prototype.initSVGGraph = function (colaGraph, camera) {
        this.colorMode = colaGraph.colorMode;
        this.directionMode = colaGraph.edgeDirectionMode;
        var width = this.jDiv.width();
        var height = this.jDiv.height() - sliderSpace;
        var widthHalf = width / 2;
        var heightHalf = height / 2;
        var projector = new THREE.Projector();
        var screenCoords = new THREE.Vector3();
        var unitRadius = 5;
        // Reset nodes and links
        this.nodes.splice(0, this.nodes.length);
        this.links.splice(0, this.links.length);
        var children = colaGraph.rootObject.children;
        // Add Nodes to SVG graph (Positions are based on the projected position of the 3D graphs
        for (var i = 0; i < children.length; i++) {
            var obj = children[i];
            if (obj.isNode) {
                var nodeObject = new Object();
                nodeObject["id"] = obj.id;
                nodeObject["label"] = this.dataSet.brainLabels[obj.id];
                nodeObject["color"] = "#".concat(colaGraph.nodeMeshes[obj.id].material.color.getHexString());
                nodeObject["radius"] = colaGraph.nodeMeshes[obj.id].scale.x * unitRadius;
                // for every attributes
                for (var j = 0; j < this.dataSet.attributes.columnNames.length; j++) {
                    var colname = this.dataSet.attributes.columnNames[j];
                    var value = this.dataSet.attributes.get(colname)[obj.id];
                    nodeObject[colname] = value;
                    // add a special property for module id
                    if (colname == 'module_id') {
                        nodeObject['moduleID'] = this.dataSet.attributes.get(colname)[obj.id];
                    }
                    //  Get domain of the attributes (assume all positive numbers in the array)
                    var columnIndex = this.dataSet.attributes.columnNames.indexOf(colname);
                    var min = this.dataSet.attributes.getMin(columnIndex);
                    var max = this.dataSet.attributes.getMax(columnIndex);
                    // Scale value to between 0.05 to 1 
                    var attrMap = d3.scale.linear().domain([min, max]).range([0.05, 1]);
                    var scalevalue = attrMap(Math.max.apply(Math, value));
                    nodeObject['scale_' + colname] = scalevalue;
                    if (dataSet.attributes.info[colname].isDiscrete) {
                        // Scale to group attirbutes 
                        var values = this.dataSet.attributes.info[colname].distinctValues;
                        nodeObject['bundle_group_' + colname] = values.indexOf(value.indexOf(Math.max.apply(Math, value)));
                    }
                    else {
                        // Scale to group attirbutes 
                        var bundleGroupMap = d3.scale.linear().domain([min, max]).range([0, 9.99]); // use 9.99 instead of 10 to avoid a group of a single element (that has the max attribute value)
                        var bundleGroup = bundleGroupMap(Math.max.apply(Math, value)); // group
                        bundleGroup = Math.floor(bundleGroup);
                        nodeObject['bundle_group_' + colname] = bundleGroup;
                    }
                }
                var v = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
                var matrixWorld = obj.matrixWorld;
                //screenCoords.setFromMatrixPosition(matrixWorld); // not sure why this method is undefined; maybe we have an old version of three.js
                screenCoords.getPositionFromMatrix(matrixWorld);
                projector.projectVector(screenCoords, camera);
                screenCoords.x = (screenCoords.x * widthHalf) + widthHalf;
                screenCoords.y = -(screenCoords.y * heightHalf) + heightHalf;
                nodeObject["x"] = screenCoords.x;
                nodeObject["y"] = screenCoords.y;
                this.nodes.push(nodeObject);
            }
        }
        // Add Edges to SVG graph
        for (var i = 0; i < colaGraph.edgeList.length; i++) {
            var edge = colaGraph.edgeList[i];
            if (edge.visible) {
                var linkObject = new Object();
                linkObject["colaGraphEdgeListIndex"] = i;
                linkObject["color"] = edge.color;
                linkObject["width"] = edge.shape.scale.x;
                for (var j = 0; j < this.nodes.length; j++) {
                    if (this.nodes[j].id == edge.sourceNode.id) {
                        linkObject["source"] = this.nodes[j];
                        linkObject["x1"] = this.nodes[j].x;
                        linkObject["y1"] = this.nodes[j].y;
                    }
                    if (this.nodes[j].id == edge.targetNode.id) {
                        linkObject["target"] = this.nodes[j];
                        linkObject["x2"] = this.nodes[j].x;
                        linkObject["y2"] = this.nodes[j].y;
                    }
                }
                this.links.push(linkObject);
            }
        }
        this.initSVGElements();
        // Update graph layout position with animation
        this.calculateLayout();
        this.transitionalUpdate();
    };
    Graph2D.prototype.initSVGElements = function () {
        var _this = this;
        var edgeDirectionMode = this.edgeDirectionMode;
        var edgeColorMode = this.edgeColorMode;
        var varDefs = this.svgDefs;
        var varSvg = this.svg[0];
        var varNS = varSvg[0].namespaceURI;
        var varDefs = this.svgDefs;
        var link = this.svgAllElements.selectAll(".link")
            .data(this.links)
            .enter().append("line")
            .attr("class", "link")
            .attr("x1", function (d) { return d.x1; })
            .attr("y1", function (d) { return d.y1; })
            .attr("x2", function (d) { return d.x2; })
            .attr("y2", function (d) { return d.y2; })
            .style("stroke-width", function (d) { return d.width; })
            .style("stroke", function (l) {
            var sourceOpacity = 1, targetOpacity = 1;
            var id = 'gradient_' + l.source.id + '_' + l.target.id;
            if (edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode != "node") {
                return l.color;
            }
            else if (l.source.color === l.target.color && edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode === "node") {
                return l.color = l.source.color;
            }
            if (edgeDirectionMode === "opacity") {
                sourceOpacity = 0;
                targetOpacity = 1;
            }
            if (edgeDirectionMode === "gradient") {
                var sourceColor = (String)(saveObj.edgeSettings.directionStartColor);
                var targetColor = (String)(saveObj.edgeSettings.directionEndColor);
            }
            else if (edgeColorMode === "node") {
                var sourceColor = String(l.source.color);
                var targetColor = String(l.target.color);
            }
            else {
                var sourceColor = String(l.color);
                var targetColor = String(l.color);
            }
            var sourceColorRGBA = CommonUtilities.hexToRgb(sourceColor, sourceOpacity).toString();
            var targetColorRGBA = CommonUtilities.hexToRgb(targetColor, targetOpacity).toString();
            var stops = [
                { 'stop-color': sourceColorRGBA },
                { offset: '100%', 'stop-color': targetColorRGBA }
            ];
            // Calculate Gradient Direction
            var box = this.getBBox();
            if (box.width > 5) {
                var x1 = (Number((this.getAttribute("x1")) - box.x) / box.width) * 100 + "%";
                var x2 = (Number((this.getAttribute("x2")) - box.x) / box.width) * 100 + "%";
            }
            else {
                var x1 = "0%";
                var x2 = "0%";
            }
            if (box.height > 5) {
                var y1 = (Number((this.getAttribute("y1")) - box.y) / box.height) * 100 + "%";
                var y2 = (Number((this.getAttribute("y2")) - box.y) / box.height) * 100 + "%";
            }
            else {
                var y1 = "0%";
                var y2 = "0%";
            }
            if ($("#" + id)[0])
                $("#" + id)[0]["remove"]();
            var grad = document.createElementNS(varNS, 'linearGradient');
            grad.setAttribute('id', id);
            grad.setAttribute('x1', x1);
            grad.setAttribute('x2', x2);
            grad.setAttribute('y1', y1);
            grad.setAttribute('y2', y2);
            for (var i = 0; i < stops.length; i++) {
                var attrs = stops[i];
                var stop = document.createElementNS(varNS, 'stop');
                for (var attr in attrs) {
                    if (attrs.hasOwnProperty(attr))
                        stop.setAttribute(attr, attrs[attr]);
                }
                grad.appendChild(stop);
            }
            varDefs.appendChild(grad);
            var gID = 'url(#' + id + ')';
            l['gradientID'] = gID;
            l.color = gID;
            return l.color;
        });
        var varMouseOveredSetNodeID = function (id) { _this.mouseOveredSetNodeID(id); };
        var varMouseOutedSetNodeID = function () { _this.mouseOutedSetNodeID(); };
        var varMouseOveredNode = function (d) { _this.mouseOveredNode(d); };
        var varMouseOutedNode = function (d) { _this.mouseOutedNode(d); };
        // Node pie chart
        var pie = d3.layout.pie();
        var dot = d3.svg.arc()
            .innerRadius(0)
            .outerRadius(5);
        var node = this.svgAllElements.selectAll(".node")
            .data(this.nodes)
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + " )"; })
            .on("mouseover", function (d) { varMouseOveredNode(d); varMouseOveredSetNodeID(d.id); })
            .on("mouseout", function (d) { varMouseOutedNode(d); varMouseOutedSetNodeID(); })
            .each(function (chartData) {
            var colorAttr = saveObj.nodeSettings.nodeColorAttribute;
            var attrArray = dataSet.attributes.get(colorAttr);
            var group = d3.select(this);
            group.selectAll("path").remove();
            if (colorAttr === "" || colorAttr === "none") {
                group.selectAll(".path")
                    .data(pie([1]))
                    .enter().append('path')
                    .attr("fill", function (d, i) { return "#d3d3d3"; })
                    .attr("d", d3.svg.arc()
                    .innerRadius(0)
                    .outerRadius(chartData.radius));
            }
            else {
                if (saveObj.nodeSettings.nodeColorMode === "discrete") {
                    var distincts = dataSet.attributes.info[colorAttr].distinctValues;
                    var colorMap = d3.scale.ordinal().domain(distincts).range(saveObj.nodeSettings.nodeColorDiscrete);
                }
                else {
                    var columnIndex = dataSet.attributes.columnNames.indexOf(colorAttr);
                    var min = dataSet.attributes.getMin(columnIndex);
                    var max = dataSet.attributes.getMax(columnIndex);
                    var minColor = saveObj.nodeSettings.nodeColorContinuousMin;
                    var maxColor = saveObj.nodeSettings.nodeColorContinuousMax;
                    var colorMap = d3.scale.linear().domain([min, max]).range([minColor, maxColor]);
                }
                if (dataSet.attributes.info[colorAttr].numElements === 1) {
                    var color = chartData[colorAttr].map(function (val) {
                        return colorMap(val).replace("0x", "#");
                    });
                }
                else {
                    var color = chartData[colorAttr].map(function (val, i) {
                        return colorMap(i).replace("0x", "#");
                    });
                }
                group.selectAll(".path")
                    .data(function () {
                    var tmp = chartData[colorAttr].map(function (val) { return val; });
                    if (tmp.length === 1 && tmp[0] === 0) {
                        return pie([1]);
                    }
                    else {
                        return pie(tmp);
                    }
                })
                    .enter().append('path')
                    .attr("fill", function (d, i) { return color[i]; })
                    .style("stroke-width", 0)
                    .attr("d", dot);
            }
        });
        node.append("title")
            .text(function (d) { return d.id; });
        node.each(function (d) { return d.width = d.height = d.radius * 2; });
        this.svgAllElements.attr("transform", "translate(0,0)");
        this.d3Zoom.scale(1);
        this.d3Zoom.translate([0, 0]);
    };
    Graph2D.prototype.initSVGGraphWithoutCola = function (colaGraph) {
        this.colorMode = colaGraph.colorMode;
        this.directionMode = colaGraph.edgeDirectionMode;
        var width = this.jDiv.width();
        var height = this.jDiv.height() - sliderSpace;
        var widthHalf = width / 2;
        var heightHalf = height / 2;
        var offsetx = 250;
        var offsety = 0;
        var initX = 3 / 5 * width;
        var initY = 1 / 2 * height;
        var projector = new THREE.Projector();
        var unitRadius = 5;
        this.nodes.splice(0, this.nodes.length);
        this.links.splice(0, this.links.length);
        var children = colaGraph.rootObject.children;
        // Add Nodes to SVG graph (Positions are based on the projected position of the 3D graphs
        for (var i = 0; i < children.length; i++) {
            var obj = children[i];
            if (obj.isNode) {
                var nodeObject = new Object();
                nodeObject["id"] = obj.id;
                nodeObject["color"] = "#".concat(colaGraph.nodeMeshes[obj.id].material.color.getHexString());
                nodeObject["radius"] = colaGraph.nodeMeshes[obj.id].scale.x * unitRadius;
                // for every attributes
                for (var j = 0; j < this.dataSet.attributes.columnNames.length; j++) {
                    var colname = this.dataSet.attributes.columnNames[j];
                    var value = this.dataSet.attributes.get(colname)[obj.id];
                    nodeObject[colname] = value;
                    // add a special property for module id
                    if (colname == 'module_id') {
                        nodeObject['moduleID'] = this.dataSet.attributes.get(colname)[obj.id];
                    }
                    //  Get domain of the attributes (assume all positive numbers in the array)
                    var columnIndex = this.dataSet.attributes.columnNames.indexOf(colname);
                    var min = this.dataSet.attributes.getMin(columnIndex);
                    var max = this.dataSet.attributes.getMax(columnIndex);
                    // Scale value to between 0.05 to 1 
                    var attrMap = d3.scale.linear().domain([min, max]).range([0.05, 1]);
                    var scalevalue = attrMap(Math.max.apply(Math, value));
                    nodeObject['scale_' + colname] = scalevalue;
                    if (this.dataSet.attributes.info[colname].isDiscrete) {
                        // Scale to group attirbutes 
                        var values = this.dataSet.attributes.info[colname].distinctValues;
                        nodeObject['bundle_group_' + colname] = values.indexOf(value.indexOf(Math.max.apply(Math, value)));
                    }
                    else {
                        // Scale to group attirbutes 
                        var bundleGroupMap = d3.scale.linear().domain([min, max]).range([0, 9.99]); // use 9.99 instead of 10 to avoid a group of a single element (that has the max attribute value)
                        var bundleGroup = bundleGroupMap(Math.max.apply(Math, value)); // group
                        bundleGroup = Math.floor(bundleGroup);
                        nodeObject['bundle_group_' + colname] = bundleGroup;
                    }
                }
                var v = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
                var matrixWorld = obj.matrixWorld;
                //screenCoords.setFromMatrixPosition(matrixWorld); // not sure why this method is undefined; maybe we have an old version of three.js
                nodeObject["x"] = initX;
                nodeObject["y"] = initY;
                this.nodes.push(nodeObject);
            }
        }
        // Add Edges to SVG graph
        for (var i = 0; i < colaGraph.edgeList.length; i++) {
            var edge = colaGraph.edgeList[i];
            if (edge.visible) {
                var linkObject = new Object();
                linkObject["colaGraphEdgeListIndex"] = i;
                linkObject["color"] = edge.color;
                linkObject["width"] = edge.shape.scale.x;
                for (var j = 0; j < this.nodes.length; j++) {
                    if (this.nodes[j].id == edge.sourceNode.id) {
                        linkObject["source"] = this.nodes[j];
                        linkObject["x1"] = this.nodes[j].x;
                        linkObject["y1"] = this.nodes[j].y;
                    }
                    if (this.nodes[j].id == edge.targetNode.id) {
                        linkObject["target"] = this.nodes[j];
                        linkObject["x2"] = this.nodes[j].x;
                        linkObject["y2"] = this.nodes[j].y;
                    }
                }
                this.links.push(linkObject);
            }
        }
        this.initSVGElements();
        // Update graph layout position with animation
        this.calculateLayout();
        this.transitionalUpdate();
    };
    Graph2D.prototype.calculateLayout = function () {
        var calDiameter = function (x) {
            // Solve triangle number for n (hexagon diameter)
            return Math.floor((-1 + Math.sqrt(1 + 8 * x)) / 2);
        };
        var radius = 10;
        var baseLength = this.edgeBaseLength;
        var lengthScale = this.edgeLengthScale;
        var groupBy = this.groupNodesBy;
        // calculate packing layout
        if (groupBy !== "none") {
            var circlePacking = d3.layout.pack()
                .sort(null)
                .radius(radius)
                .padding(1.5);
            //.margin(10);
            // Group nodes according to attribute
            var groupMap = {};
            var groupJson = [];
            var groupLinkJson = [];
            this.nodes.forEach(function (v, i) {
                var values = v[groupBy];
                var group = "";
                var attrCount = 0;
                var isSingle = true;
                // define groups
                if (values.length === 1) {
                    group += values[0];
                    attrCount++;
                }
                else {
                    values.forEach(function (v, i) {
                        if (v > 0) {
                            attrCount++;
                            group += i + "-";
                        }
                    });
                    group = group.substring(0, group.length - 1);
                }
                isSingle = (attrCount === 1);
                if (typeof groupMap[group] == 'undefined') {
                    groupMap[group] = { children: [], isSingle: isSingle };
                }
                // Add node to the group
                v.value = 5; // value attribute is required by circle packing layout
                groupMap[group].children.push(v);
            });
            // Add every groups into an array
            var counter = 0;
            for (var g in groupMap) {
                groupJson.push({
                    id: counter,
                    width: (calDiameter(groupMap[g].children.length) + 1) * radius * 2,
                    height: (calDiameter(groupMap[g].children.length) + 1) * radius * 2,
                    name: groupMap[g].name
                });
                groupMap[g].index = counter;
                groupMap[g].children.forEach(function (v, i) {
                    v.groupID = counter;
                    v.isSingle = groupMap[g].isSingle;
                });
                // Calculate node's poitions for each group
                circlePacking.nodes(groupMap[g]);
                counter++;
            }
            // Find connections between modules. 
            for (var g in groupMap) {
                var relatedGroups = g.split("-");
                if (relatedGroups.length !== 1) {
                    relatedGroups.forEach(function (rg) {
                        if (typeof groupMap[rg] === "undefined")
                            return;
                        groupLinkJson.push({
                            source: groupMap[g].index,
                            target: groupMap[rg].index,
                            value: 1
                        });
                    });
                }
            }
            if (groupLinkJson.length === 0) {
                var linkMap = {};
                var nodes = this.nodes;
                this.links.forEach(function (v, i) {
                    if (v.source.groupID === v.target.groupID)
                        return;
                    var linkID = "";
                    if (v.source.groupID > v.target.groupID) {
                        linkID = v.source.groupID + "-" + v.target.groupID;
                    }
                    else {
                        linkID = v.target.groupID + "-" + v.source.groupID;
                    }
                    if (typeof linkMap[linkID] === "undefined") {
                        linkMap[linkID] = {
                            source: v.source.groupID,
                            target: v.target.groupID,
                            value: 1
                        };
                    }
                    else {
                        linkMap[linkID].value++;
                    }
                });
                for (var l in linkMap) {
                    groupLinkJson.push(linkMap[l]);
                }
            }
            var cola2D = colans.d3adaptor()
                .size([this.jDiv.width(), this.jDiv.height() - sliderSpace]);
            cola2D
                .handleDisconnected(true)
                .avoidOverlaps(true)
                .nodes(groupJson)
                .links(groupLinkJson)
                .linkDistance(function (l) {
                return baseLength * lengthScale * 5;
            });
            cola2D.start(30, 0, 30);
            // Translate Nodes to perspective group
            this.nodes.forEach(function (v, i) {
                v.x += groupJson[v.groupID].x;
                v.y += groupJson[v.groupID].y;
            });
        }
        else {
            var cola2D = colans.d3adaptor()
                .size([this.jDiv.width(), this.jDiv.height() - sliderSpace]);
            cola2D
                .handleDisconnected(true)
                .avoidOverlaps(true)
                .nodes(this.nodes)
                .links(this.links)
                .linkDistance(function () {
                return lengthScale * baseLength;
            });
            if (this.isFlowLayoutOn) {
                cola2D
                    .flowLayout('y', 10);
            }
            cola2D.start(30, 0, 30);
        }
    };
    Graph2D.prototype.settingOnChange = function () {
        var lengthScale = this.edgeLengthScale;
        var baseLength = this.edgeBaseLength;
        var isOn = this.isFlowLayoutOn;
        var groupBy = this.groupNodesBy;
        var width = this.jDiv.width();
        var height = this.jDiv.height() - sliderSpace;
        var widthHalf = width / 2;
        var heightHalf = height / 2;
        var projector = new THREE.Projector();
        var screenCoords = new THREE.Vector3();
        var unitRadius = 5;
        var edgeColorMode = this.colorMode;
        var edgeDirectionMode = this.directionMode;
        var varSvg = this.svg[0];
        var varNS = varSvg[0].namespaceURI;
        var varDefs = this.svgDefs;
        // Update data of the visualisation
        // Cola require width and height of each element 
        this.nodes.forEach(function (e) {
            e.width = e.height = e.radius * 2;
            e.r = e.radius;
        });
        this.svgAllElements.attr("transform", "translate(0,0)");
        this.d3Zoom.scale(1);
        this.d3Zoom.translate([0, 0]);
        this.calculateLayout();
        this.transitionalUpdate();
    };
    Graph2D.prototype.updateLabels = function (isShownLabel) {
        if (isShownLabel) {
            this.svgAllElements.selectAll(".nodeLabel")
                .style("visibility", "visible");
        }
        else {
            this.svgAllElements.selectAll(".nodeLabel")
                .style("visibility", "hidden");
        }
    };
    Graph2D.prototype.mouseOveredSetNodeID = function (id) {
        this.commonData.nodeIDUnderPointer[4] = id;
    };
    Graph2D.prototype.mouseOutedSetNodeID = function () {
        this.commonData.nodeIDUnderPointer[4] = -1;
    };
    Graph2D.prototype.mouseOutedNode = function (d) {
        //this.commonData.nodeIDUnderPointer[4] = -1;
        var selectedID = this.commonData.selectedNode;
        if (selectedID == -1) {
            this.svgAllElements.selectAll(".link")
                .style("stroke-width", "1px")
                .style("stroke-opacity", 1);
            this.svgAllElements.selectAll(".node")
                .style("opacity", 1);
        }
        else {
            // Reseting All nodes source and target
            this.svgAllElements.selectAll(".node")
                .each(function (n) { n.target = n.source = false; }); // For every node in the graph
            var varEdgeColorMode = this.edgeColorMode;
            this.svgAllElements.selectAll(".link")
                .style("stroke-width", function (l) {
                // if the link is associated with the selected node in anyway (source or target)
                if (l.source.id === selectedID) {
                    l.source.source = true;
                    l.target.target = true;
                }
                if (l.target.id === selectedID) {
                    l.source.source = true;
                    l.target.target = true;
                }
                // Reassign line width to all links base on the given information
                if (l.source.id == selectedID || l.target.id == selectedID) {
                    return "3px";
                }
                else {
                    return "1px";
                }
            })
                .style("stroke-opacity", function (l) {
                if (l.source.id == selectedID || l.target.id == selectedID) {
                    return 1;
                }
                else {
                    return 0.2;
                }
            });
            this.svgAllElements.selectAll(".node")
                .style("opacity", function (n) {
                if (n.target || n.source) {
                    return 1;
                }
                else {
                    return 0.2;
                }
            });
            ;
        }
    };
    Graph2D.prototype.mouseOveredNode = function (d) {
        var selectedID = this.commonData.selectedNode;
        // Reseting All nodes source and target
        this.svgAllElements.selectAll(".node")
            .each(function (n, i) {
            n.index = i;
            n.target = n.source = false;
        }); // For every node in the graph
        var varEdgeColorMode = this.edgeColorMode;
        this.svgAllElements.selectAll(".link")
            .style("stroke-width", function (l) {
            // if the link is associated with the selected node in anyway (source or target)
            if (l.target.id === d.id) {
                l.target.source = true;
                l.source.target = true;
            }
            if (l.source.id === d.id) {
                l.source.source = true;
                l.target.target = true;
            }
            if (l.source.id === selectedID) {
                l.source.source = true;
                l.target.target = true;
            }
            if (l.target.id === selectedID) {
                l.source.source = true;
                l.target.target = true;
            }
            // Reassign line width to all links base on the given information
            if (l.target === d || l.source === d || l.source.id === selectedID || l.target.id === selectedID) {
                return "3px";
            }
            else {
                return "1px";
            }
        })
            .style("stroke-opacity", function (l) {
            if (l.target === d || l.source === d || l.source.id === selectedID || l.target.id === selectedID) {
                return 1;
            }
            else {
                return 0.2;
            }
        });
        this.svgAllElements.selectAll(".node")
            .style("opacity", function (n) {
            if (n.target || n.source) {
                return 1;
            }
            else {
                return 0.2;
            }
        });
        ;
    };
    Graph2D.prototype.clear = function () {
        this.nodes = [];
        this.links = [];
        var node = this.svgAllElements.selectAll(".node").data(new Array());
        var link = this.svgAllElements.selectAll(".link").data(new Array());
        var nodeLabel = this.svgAllElements.selectAll(".nodeLabel").data(new Array());
        var groupRect = this.svgAllElements.selectAll(".group").data(new Array());
        node.exit().remove();
        link.exit().remove();
        nodeLabel.exit().remove();
        groupRect.exit().remove();
    };
    Graph2D.prototype.updateEdgeColorMode = function (colorMode) {
        this.isEdgeColorChanged = true;
        this.colorMode = colorMode;
    };
    Graph2D.prototype.updateEdgeDirectionMode = function (directionMode) {
        if (this.directionMode === directionMode)
            return;
        // remove old direction mode 
        if (this.directionMode === "arrow") {
            this.toggleDirectionArrow(false);
        }
        else if (this.directionMode === "ansimation") {
        }
        else if (this.directionMode === "opacity") {
        }
        // Apply new direction mode
        if (directionMode === "arrow") {
            this.toggleDirectionArrow(true);
        }
        else if (directionMode === "animation") {
        }
        else if (directionMode === "opacity") {
        }
        this.directionMode = directionMode;
        this.isEdgeColorChanged = true;
    };
    Graph2D.prototype.updateEdgeColor = function () {
        var edgeColorMode = this.colorMode;
        var edgeDirectionMode = this.directionMode;
        var varSvg = this.svg[0];
        var varNS = varSvg[0].namespaceURI;
        var varDefs = this.svgDefs;
        var link = this.svgAllElements.selectAll(".link")
            .style("stroke", function (l) {
            var sourceOpacity = 1, targetOpacity = 1;
            var id = 'gradient_' + l.source.id + '_' + l.target.id;
            if (edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode != "node") {
                return l.color;
            }
            else if (l.source.color === l.target.color && edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode === "node") {
                return l.color = l.source.color;
            }
            if (edgeDirectionMode === "opacity") {
                sourceOpacity = 0;
                targetOpacity = 1;
            }
            if (edgeDirectionMode === "gradient") {
                var sourceColor = (String)(saveObj.edgeSettings.directionStartColor);
                var targetColor = (String)(saveObj.edgeSettings.directionEndColor);
            }
            else if (edgeColorMode === "node") {
                var sourceColor = String(l.source.color);
                var targetColor = String(l.target.color);
            }
            else {
                var sourceColor = String(l.color);
                var targetColor = String(l.color);
            }
            var sourceColorRGBA = CommonUtilities.hexToRgb(sourceColor, sourceOpacity).toString();
            var targetColorRGBA = CommonUtilities.hexToRgb(targetColor, targetOpacity).toString();
            var stops = [
                { offset: '0%', 'stop-color': sourceColorRGBA },
                { offset: '100%', 'stop-color': targetColorRGBA }
            ];
            // Calculate Gradient Direction
            var box = this.getBBox();
            if (box.width > 5) {
                var x1 = (Number((this.getAttribute("x1")) - box.x) / box.width) * 100 + "%";
                var x2 = (Number((this.getAttribute("x2")) - box.x) / box.width) * 100 + "%";
            }
            else {
                var x1 = "0%";
                var x2 = "0%";
            }
            if (box.height > 5) {
                var y1 = (Number((this.getAttribute("y1")) - box.y) / box.height) * 100 + "%";
                var y2 = (Number((this.getAttribute("y2")) - box.y) / box.height) * 100 + "%";
            }
            else {
                var y1 = "0%";
                var y2 = "0%";
            }
            if ($("#" + id)[0])
                $("#" + id)[0]["remove"]();
            var grad = document.createElementNS(varNS, 'linearGradient');
            grad.setAttribute('id', id);
            grad.setAttribute('x1', x1);
            grad.setAttribute('x2', x2);
            grad.setAttribute('y1', y1);
            grad.setAttribute('y2', y2);
            for (var i = 0; i < stops.length; i++) {
                var attrs = stops[i];
                var stop = document.createElementNS(varNS, 'stop');
                for (var attr in attrs) {
                    if (attrs.hasOwnProperty(attr))
                        stop.setAttribute(attr, attrs[attr]);
                }
                grad.appendChild(stop);
            }
            varDefs.appendChild(grad);
            var gID = 'url(#' + id + ')';
            l['gradientID'] = gID;
            l.color = gID;
            return l.color;
        });
        this.isEdgeColorChanged = false;
    };
    // NOTE: THIS USED TO BE ANIMATED. WE REMOVED THE ANIMATION SO THE "TRANSITION" CODE IS A KINDA POINTLESS ZERO DURATION ONE.
    Graph2D.prototype.transitionalUpdate = function () {
        var offsetx = 250;
        var offsety = 0;
        var node = this.svgAllElements.selectAll(".node").data(this.nodes);
        this.nodes.forEach(function (d) {
        });
        node.each(function (d) {
            d.x += offsetx;
            d.y += offsety;
        });
        node.each(function (d) { return d.width = d.height = d.radius * 2; });
        node.transition().duration(0) // zero duration; don't animate
            .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + " )"; });
        var link = this.svgAllElements.selectAll(".link").data(this.links);
        var nodes = this.nodes;
        link.transition().duration(0)
            .attr("x1", function (d) {
            if (typeof d.source === "object") {
                return d.source.x;
            }
            else {
                return nodes[d.source].x;
            }
        })
            .attr("y1", function (d) {
            if (typeof d.source === "object") {
                return d.source.y;
            }
            else {
                return nodes[d.source].y;
            }
        })
            .attr("x2", function (d) {
            if (typeof d.target === "object") {
                return d.target.x;
            }
            else {
                return nodes[d.target].x;
            }
        })
            .attr("y2", function (d) {
            if (typeof d.target === "object") {
                return d.target.y;
            }
            else {
                return nodes[d.target].y;
            }
        });
        // update the this.svgNodeArray
        var colaNodeData = this.svgAllElements.selectAll(".node").data();
        for (var i = 0; i < colaNodeData.length; i++) {
            this.nodes[i].x = colaNodeData[i].x;
            this.nodes[i].y = colaNodeData[i].y;
        }
        // node label
        var svgLabelArray = [];
        var colaNodeData = this.svgAllElements.selectAll(".node").data();
        for (var i = 0; i < colaNodeData.length; i++) {
            var labelObject = new Object();
            labelObject["x"] = colaNodeData[i].x;
            labelObject["y"] = colaNodeData[i].y;
            labelObject["id"] = colaNodeData[i].id;
            labelObject["label"] = colaNodeData[i].label;
            labelObject["node_radius"] = colaNodeData[i].radius;
            svgLabelArray.push(labelObject);
        }
        var labelJson = JSON.parse(JSON.stringify(svgLabelArray));
        var nodeLable = this.svgAllElements.selectAll(".nodeLabel")
            .data(labelJson)
            .enter().append("text")
            .attr("class", "nodeLabel")
            .attr("x", function (d) { return d.x + 3.5; })
            .attr("y", function (d) { return d.y - 3.5; })
            .text(function (d) { return d.label; })
            .style("visibility", "hidden");
    };
    Graph2D.prototype.update = function (colaGraph, isShownLabel) {
        var unitRadius = 5;
        for (var i = 0; i < this.nodes.length; i++) {
            var id = this.nodes[i].id;
            this.nodes[i].color = "#".concat(colaGraph.nodeMeshes[id].material.color.getHexString());
            this.nodes[i].radius = colaGraph.nodeMeshes[id].scale.x * unitRadius;
        }
        for (var i = 0; i < this.links.length; i++) {
            var index = this.links[i].colaGraphEdgeListIndex;
            var edge = colaGraph.edgeList[index];
            this.links[i].color = edge.color;
            this.links[i].width = edge.shape.scale.x;
        }
        var link = this.svgAllElements.selectAll(".link")
            .data(this.links)
            .style("stroke-width", function (d) { return d.width; });
        if (this.isEdgeColorChanged) {
            this.updateEdgeColor();
        }
        // Node pie chart
        var pie = d3.layout.pie();
        var dot = d3.svg.arc()
            .innerRadius(0)
            .outerRadius(5);
        var node = this.svgAllElements.selectAll(".node")
            .data(this.nodes)
            .attr("r", function (d) { return d.radius; })
            .each(function (chartData) {
            var colorAttr = saveObj.nodeSettings.nodeColorAttribute;
            var attrArray = dataSet.attributes.get(colorAttr);
            var group = d3.select(this);
            group.selectAll("path").remove();
            if (colorAttr === "" || colorAttr === "none") {
                group.selectAll(".path")
                    .data(pie([1]))
                    .enter().append('path')
                    .attr("fill", function (d, i) { return "#d3d3d3"; })
                    .attr("id", "testing")
                    .attr("d", d3.svg.arc()
                    .innerRadius(0)
                    .outerRadius(chartData.radius));
            }
            else {
                if (saveObj.nodeSettings.nodeColorMode === "discrete") {
                    var distincts = dataSet.attributes.info[colorAttr].distinctValues;
                    var colorMap = d3.scale.ordinal().domain(distincts).range(saveObj.nodeSettings.nodeColorDiscrete);
                }
                else {
                    var columnIndex = dataSet.attributes.columnNames.indexOf(colorAttr);
                    var min = dataSet.attributes.getMin(columnIndex);
                    var max = dataSet.attributes.getMax(columnIndex);
                    var minColor = saveObj.nodeSettings.nodeColorContinuousMin;
                    var maxColor = saveObj.nodeSettings.nodeColorContinuousMax;
                    var colorMap = d3.scale.linear().domain([min, max]).range([minColor, maxColor]);
                }
                if (dataSet.attributes.info[colorAttr].numElements === 1) {
                    var color = chartData[colorAttr].map(function (val) {
                        return colorMap(val).replace("0x", "#");
                    });
                }
                else {
                    var color = chartData[colorAttr].map(function (val, i) {
                        return colorMap(i).replace("0x", "#");
                    });
                }
                group.selectAll(".path")
                    .data(function () {
                    var tmp = chartData[colorAttr].map(function (val) { return val; });
                    if (tmp.length === 1 && tmp[0] === 0) {
                        return pie([1]);
                    }
                    else {
                        return pie(tmp);
                    }
                })
                    .enter().append('path')
                    .attr("fill", function (d, i) { return color[i]; })
                    .style("stroke-width", 0)
                    .attr("d", d3.svg.arc()
                    .innerRadius(0)
                    .outerRadius(chartData.radius));
            }
        });
        // node labels
        if (isShownLabel) {
            this.svgAllElements.selectAll(".nodeLabel")
                .style("visibility", "visible");
        }
        else {
            this.svgAllElements.selectAll(".nodeLabel")
                .style("visibility", "hidden");
        }
        var svgLabelArray = [];
        var colaNodeData = this.svgAllElements.selectAll(".node").data();
        for (var i = 0; i < colaNodeData.length; i++) {
            var labelObject = new Object();
            labelObject["x"] = colaNodeData[i].x;
            labelObject["y"] = colaNodeData[i].y;
            labelObject["id"] = colaNodeData[i].id;
            labelObject["label"] = colaNodeData[i].label;
            labelObject["node_radius"] = colaNodeData[i].radius;
            svgLabelArray.push(labelObject);
        }
        var labelJson = JSON.parse(JSON.stringify(svgLabelArray));
        var scale = this.d3Zoom.scale();
        var defaultFontSize = 10;
        var fontSize = defaultFontSize;
        if (scale >= 1) {
            fontSize = Math.ceil(defaultFontSize / scale);
        }
        var nodeLable = this.svgAllElements.selectAll(".nodeLabel")
            .data(labelJson)
            .style("font-size", fontSize + 'px');
        nodeLable.each(function (d) {
            var box = this.getBBox();
            var width = box.width;
            var height = box.height;
            if ((box.width <= d.node_radius * 2) && (box.height <= d.node_radius * 2)) {
                d.x -= box.width / 2;
                d.y += (box.height / 2 - 1);
            }
            else {
                d.x += 3.5;
                d.y -= 3.5;
            }
        });
        nodeLable
            .attr("x", function (d) { return d.x; })
            .attr("y", function (d) { return d.y; });
    };
    return Graph2D;
}());
var Graph = (function () {
    function Graph(parentObject, adjMatrix, nodeColorings, weightMatrix, labels, commonData) {
        this.edgeMaxWeight = Number.MIN_VALUE;
        this.edgeMinWeight = Number.MAX_VALUE;
        this.edgeList = [];
        this.edgeThicknessByWeight = false;
        this.colorMode = "none";
        this.bundlingEdgeList = [];
        this.visible = true;
        this.allLabels = false;
        this.parentObject = parentObject;
        this.rootObject = new THREE.Object3D();
        this.commonData = commonData;
        this.edgeDirectionMode = "none";
        parentObject.add(this.rootObject);
        // Create all the node meshes
        this.nodeMeshes = Array(adjMatrix.length);
        this.nodeInfo = Array.apply(null, Array(adjMatrix.length)).map(function (x, i) {
            return {
                isSelected: false
            };
        });
        this.nodeDefaultColor = nodeColorings.slice(0); // clone the array
        this.nodeCurrentColor = nodeColorings.slice(0); // clone the array
        for (var i = 0; i < adjMatrix.length; ++i) {
            var sphere = this.nodeMeshes[i] = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 10), new THREE.MeshLambertMaterial({ color: nodeColorings[i] }));
            this.nodeInfo[i]["label"] = this.createNodeLabel(labels[i], 6);
            // additional flag
            sphere.isNode = true; // A flag to identify the node meshes
            sphere.hasVisibleEdges = true;
            sphere.id = i;
            this.rootObject.add(sphere);
        }
        // Create all the edges
        var len = adjMatrix.length;
        for (var i = 0; i < len - 1; ++i) {
            adjMatrix[i][i] = null;
            for (var j = i + 1; j < len; ++j) {
                if (adjMatrix[i][j] === 1 || adjMatrix[j][i] === 1) {
                    if (this.edgeMinWeight > weightMatrix[i][j]) {
                        this.edgeMinWeight = weightMatrix[i][j];
                    }
                    else if (this.edgeMinWeight > weightMatrix[j][i]) {
                        this.edgeMinWeight = weightMatrix[j][i];
                    }
                    if (this.edgeMaxWeight < weightMatrix[i][j]) {
                        this.edgeMaxWeight = weightMatrix[i][j];
                    }
                    else if (this.edgeMaxWeight < weightMatrix[j][i]) {
                        this.edgeMaxWeight = weightMatrix[j][i];
                    }
                    if (weightMatrix[i][j] > weightMatrix[j][i]) {
                        this.edgeList.push(adjMatrix[i][j] = new Edge(this.rootObject, this.nodeMeshes[i], this.nodeMeshes[j], weightMatrix[i][j])); // assume symmetric matrix
                        adjMatrix[j][i] = null;
                    }
                    else {
                        this.edgeList.push(adjMatrix[j][i] = new Edge(this.rootObject, this.nodeMeshes[j], this.nodeMeshes[i], weightMatrix[j][i])); // assume symmetric matrix
                        adjMatrix[i][j] = null;
                    }
                }
                else {
                    adjMatrix[i][j] = null;
                    adjMatrix[j][i] = null;
                }
            }
        }
        adjMatrix[len - 1][len - 1] = null;
        this.edgeMatrix = adjMatrix;
    }
    //////////////////////////////////////////////
    /////// Node's Functions /////////////////////
    //////////////////////////////////////////////
    Graph.prototype.createNodeLabel = function (text, fontSize) {
        // draw text on canvas 
        var multiplyScale = 3; // for higher resolution of the label
        var varFontSize = fontSize * multiplyScale;
        // 1. create a canvas element
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        context.font = "Bold " + varFontSize + "px Arial";
        canvas.width = context.measureText(text).width;
        canvas.height = varFontSize;
        context.font = varFontSize + "px Arial";
        context.fillStyle = "rgba(0,0,0,1)";
        context.fillText(text, 0, varFontSize);
        // 2. canvas contents will be used for a texture
        var texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        // 3. map texture to an object
        // method 1: do not face the camera
        /*
        var material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        material.transparent = true;

        var mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(canvas.width, canvas.height),
            material
            );
        mesh.scale.set(0.1, 0.1, 1);
        return mesh;
 
               */
        // method 2:
        var spriteMaterial = new THREE.SpriteMaterial({ map: texture, useScreenCoordinates: false, depthTest: false });
        var sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(canvas.width / multiplyScale, canvas.height / multiplyScale, 1);
        return sprite;
    };
    Graph.prototype.setNodePositions = function (colaCoords) {
        this.nodePositions = colaCoords;
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].position.x = colaCoords[0][i];
            this.nodeMeshes[i].position.y = colaCoords[1][i];
            this.nodeMeshes[i].position.z = colaCoords[2][i];
            // set the node label position 
            this.nodeInfo[i]["label"].position.x = this.nodeMeshes[i].position.x + 5;
            this.nodeInfo[i]["label"].position.y = this.nodeMeshes[i].position.y + 5;
            this.nodeInfo[i]["label"].position.z = this.nodeMeshes[i].position.z;
        }
    };
    // Lerp between the physio and Cola positions of the nodes
    // 0 <= t <= 1
    Graph.prototype.setNodePositionsLerp = function (colaCoords1, colaCoords2, t) {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].position.x = colaCoords1[0][i] * (1 - t) + colaCoords2[0][i] * t;
            this.nodeMeshes[i].position.y = colaCoords1[1][i] * (1 - t) + colaCoords2[1][i] * t;
            this.nodeMeshes[i].position.z = colaCoords1[2][i] * (1 - t) + colaCoords2[2][i] * t;
            // set the node label position 
            this.nodeInfo[i]["label"].position.x = this.nodeMeshes[i].position.x + 5;
            this.nodeInfo[i]["label"].position.y = this.nodeMeshes[i].position.y + 5;
            this.nodeInfo[i]["label"].position.z = this.nodeMeshes[i].position.z;
        }
    };
    Graph.prototype.setVisible = function (flag) {
        if (flag) {
            if (!this.visible) {
                this.parentObject.add(this.rootObject);
                this.visible = true;
            }
        }
        else {
            if (this.visible) {
                this.parentObject.remove(this.rootObject);
                this.visible = false;
            }
        }
    };
    Graph.prototype.isVisible = function () {
        return this.visible;
    };
    // used by physioGraph
    Graph.prototype.applyNodeFiltering = function () {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.rootObject.remove(this.nodeMeshes[i]);
        }
        if (this.filteredNodeIDs) {
            for (var j = 0; j < this.filteredNodeIDs.length; ++j) {
                var nodeID = this.filteredNodeIDs[j];
                this.rootObject.add(this.nodeMeshes[nodeID]);
            }
        }
    };
    Graph.prototype.findNodeConnectivity = function (filteredAdjMatrix, dissimilarityMatrix, edges) {
        var hasNeighbours = Array(this.nodeMeshes.length);
        for (var i = 0; i < this.nodeMeshes.length - 1; ++i) {
            for (var j = i + 1; j < this.nodeMeshes.length; ++j) {
                if (filteredAdjMatrix[i][j] === 1) {
                    if (this.filteredNodeIDs) {
                        if ((this.filteredNodeIDs.indexOf(i) != -1) && (this.filteredNodeIDs.indexOf(j) != -1)) {
                            var len = dissimilarityMatrix[i][j];
                            if (edges)
                                edges.push({ source: i, target: j, length: len });
                            hasNeighbours[i] = true;
                            hasNeighbours[j] = true;
                        }
                    }
                    else {
                        var len = dissimilarityMatrix[i][j];
                        if (edges)
                            edges.push({ source: i, target: j, length: len });
                        hasNeighbours[i] = true;
                        hasNeighbours[j] = true;
                    }
                }
                else if (filteredAdjMatrix[j][i] === 1) {
                    if (this.filteredNodeIDs) {
                        if ((this.filteredNodeIDs.indexOf(i) != -1) && (this.filteredNodeIDs.indexOf(j) != -1)) {
                            var len = dissimilarityMatrix[i][j];
                            if (edges)
                                edges.push({ source: j, target: i, length: len });
                            hasNeighbours[i] = true;
                            hasNeighbours[j] = true;
                        }
                    }
                    else {
                        var len = dissimilarityMatrix[i][j];
                        if (edges)
                            edges.push({ source: j, target: i, length: len });
                        hasNeighbours[i] = true;
                        hasNeighbours[j] = true;
                    }
                }
            }
        }
        this.nodeHasNeighbors = hasNeighbours.slice(0);
    };
    // used by 
    Graph.prototype.setNodeVisibilities = function () {
        if (!this.nodeHasNeighbors)
            return;
        for (var i = 0; i < this.nodeHasNeighbors.length; ++i) {
            if (this.nodeHasNeighbors[i]) {
                if (this.filteredNodeIDs) {
                    if (this.filteredNodeIDs.indexOf(i) != -1) {
                        this.rootObject.add(this.nodeMeshes[i]);
                    }
                    else {
                        this.rootObject.remove(this.nodeMeshes[i]);
                    }
                }
                else {
                    this.rootObject.add(this.nodeMeshes[i]);
                }
            }
            else {
                this.rootObject.remove(this.nodeMeshes[i]);
            }
        }
    };
    Graph.prototype.highlightSelectedNodes = function (filteredIDs) {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            if (filteredIDs.indexOf(i) == -1) {
                this.nodeMeshes[i].material.color.setHex(this.nodeCurrentColor[i]);
            }
            else {
                this.nodeMeshes[i].material.color.setHex(0xFFFF00); // highlight color
            }
        }
    };
    Graph.prototype.setDefaultNodeScale = function () {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].scale.set(1, 1, 1);
        }
    };
    Graph.prototype.setDefaultNodeColor = function () {
        this.nodeCurrentColor = this.nodeDefaultColor.slice(0);
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].material.color.setHex(this.nodeDefaultColor[i]);
        }
    };
    Graph.prototype.setNodesScale = function (scaleArray) {
        if (!scaleArray)
            return;
        if (scaleArray.length != this.nodeMeshes.length)
            return;
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            var scale = scaleArray[i];
            this.nodeMeshes[i].scale.set(scale, scale, scale);
        }
    };
    //////////////////////////////////////////////
    /////// Edge's Functions /////////////////////
    //////////////////////////////////////////////
    Graph.prototype.setEdgeDirection = function (directionMode) {
        if (this.edgeDirectionMode === directionMode)
            return;
        // remove old direction mode
        if (this.edgeDirectionMode === "arrow") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].toggleArrow(false);
            }
        }
        else if (this.edgeDirectionMode === "animation") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].uniforms.isAnimationOn.value = 0;
                ;
            }
        }
        else if (this.edgeDirectionMode === "opacity") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].setOpacity(1, 1);
            }
        }
        else if (this.edgeDirectionMode === "gradient") {
            // return to current edge color settings
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].directionMode = directionMode;
                this.edgeList[i].updateColor();
            }
        }
        this.edgeDirectionMode = directionMode;
        // Apply new direction mode
        if (directionMode === "arrow") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].directionMode = directionMode;
                this.edgeList[i].toggleArrow(true);
                this.edgeList[i].updateColor();
            }
        }
        else if (directionMode === "animation") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].directionMode = directionMode;
                this.edgeList[i].uniforms.isAnimationOn.value = 1;
                this.edgeList[i].updateColor();
            }
        }
        else if (directionMode === "opacity") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].directionMode = directionMode;
                this.edgeList[i].setOpacity(-0.5, 1);
                ;
                this.edgeList[i].updateColor();
            }
        }
        else if (directionMode === "gradient") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].directionMode = directionMode;
                this.edgeList[i].updateColor();
            }
        }
    };
    Graph.prototype.setEdgeOpacity = function (opacity) {
        for (var i = 0; i < this.edgeList.length; i++) {
            var edge = this.edgeList[i];
            edge.uniforms.endOpacity.value = opacity;
            if (this.edgeDirectionMode !== "opacity") {
                edge.uniforms.startOpacity.value = opacity;
            }
            edge.isColorChanged = true;
        }
    };
    Graph.prototype.setEdgeDirectionGradient = function () {
        var startRGB = CommonUtilities.hexToRgb(saveObj.edgeSettings.directionStartColor, 1.0);
        var endRGB = CommonUtilities.hexToRgb(saveObj.edgeSettings.directionEndColor, 1.0);
        for (var i = 0; i < this.edgeList.length; i++) {
            var edge = this.edgeList[i];
            edge.uniforms.startColor.value = new THREE.Vector4(startRGB.r / 255, startRGB.g / 255, startRGB.b / 255, 1.0);
            edge.uniforms.endColor.value = new THREE.Vector4(endRGB.r / 255, endRGB.g / 255, endRGB.b / 255, 1.0);
        }
    };
    Graph.prototype.setEdgeColorConfig = function (colorMode, config) {
        this.colorMode = colorMode;
        this.edgeColorConfig = config;
        if (colorMode === "weight") {
            if (config.type === "continuous-normal") {
                this.edgeMinColor = config.minColor;
                this.edgeMaxColor = config.maxColor;
                var func = d3.scale.linear()
                    .domain([this.edgeMinWeight, this.edgeMaxWeight])
                    .range([config.minColor, config.maxColor]);
                for (var i = 0; i < this.edgeList.length; i++) {
                    var edge = this.edgeList[i];
                    edge.colorMode = colorMode;
                    edge.colorMapFunction = func;
                    edge.isColorChanged = true;
                }
            }
            else if (config.type === "discrete") {
                var func = d3.scale.ordinal()
                    .domain(config.valueArray)
                    .range(config.colorArray);
                for (var i = 0; i < this.edgeList.length; i++) {
                    var edge = this.edgeList[i];
                    edge.colorMode = colorMode;
                    edge.colorMapFunction = func;
                    edge.isColorChanged = true;
                }
            }
            else if (config.type === "continuous-discretized") {
                var colorArray = config.colorArray.slice(0);
                var domainArray = config.domainArray.slice(0);
                colorArray.unshift("#000000");
                colorArray.push("#000000");
                domainArray[domainArray.length - 1] += 0.00000001;
                var func = d3.scale.threshold()
                    .domain(domainArray)
                    .range(colorArray);
                for (var i = 0; i < this.edgeList.length; i++) {
                    var edge = this.edgeList[i];
                    edge.colorMode = colorMode;
                    edge.colorMapFunction = func;
                    edge.isColorChanged = true;
                }
            }
        }
        else if (colorMode === "node") {
            for (var i = 0; i < this.edgeList.length; i++) {
                var edge = this.edgeList[i];
                edge.colorMode = colorMode;
                edge.isColorChanged = true;
            }
        }
        else if (colorMode === "none") {
            for (var i = 0; i < this.edgeList.length; i++) {
                var edge = this.edgeList[i];
                edge.colorMode = colorMode;
                edge.isColorChanged = true;
            }
        }
    };
    Graph.prototype.setEdgeVisibilities = function (visMatrix) {
        var len = visMatrix.length;
        // reset minWeight and maxWeight values of the edges
        this.edgeMaxWeight = Number.MIN_VALUE;
        this.edgeMinWeight = Number.MAX_VALUE;
        // reset node's hasVisibleEdges flag
        for (var i = 0; i < len - 1; ++i) {
            this.nodeMeshes[i].hasVisibleEdges = false;
        }
        // reset Edges' Visibilities 
        for (var i = 0; i < len - 1; ++i) {
            for (var j = i + 1; j < len; ++j) {
                if (this.edgeMatrix[i][j] || this.edgeMatrix[j][i]) {
                    var edge = (this.edgeMatrix[i][j]) ? this.edgeMatrix[i][j] : this.edgeMatrix[j][i];
                    if (this.filteredNodeIDs && ((this.filteredNodeIDs.indexOf(i) == -1) || (this.filteredNodeIDs.indexOf(j) == -1))) {
                        edge.setVisible(false);
                    }
                    else if (visMatrix[i][j] === 1 || visMatrix[j][i] === 1) {
                        this.nodeMeshes[i].hasVisibleEdges = true;
                        this.nodeMeshes[j].hasVisibleEdges = true;
                        edge.setVisible(true);
                    }
                    else {
                        edge.setVisible(false);
                    }
                }
                // update minWeight and maxWeight
                if (edge && (visMatrix[i][j] === 1 || visMatrix[j][i] === 1)) {
                    if (this.edgeMinWeight > edge.getWeight()) {
                        this.edgeMinWeight = edge.getWeight();
                    }
                    if (this.edgeMaxWeight < edge.getWeight()) {
                        this.edgeMaxWeight = edge.getWeight();
                    }
                }
            }
        }
        if (this.colorMode === "weight") {
            // update edges' color map
            this.setEdgeColorConfig(this.colorMode, this.edgeColorConfig);
        }
        else {
            this.setEdgeColorConfig(this.colorMode);
        }
    };
    Graph.prototype.addBundlingEdge = function (line) {
        line.isBundlingEdge = true;
        this.bundlingEdgeList.push(line);
        this.rootObject.add(line);
    };
    Graph.prototype.removeAllBundlingEdges = function () {
        for (var i = 0; i < this.bundlingEdgeList.length; ++i) {
            this.rootObject.remove(this.bundlingEdgeList[i]);
        }
        // remove all elements in the list
        this.bundlingEdgeList.splice(0, this.bundlingEdgeList.length);
    };
    Graph.prototype.removeAllEdges = function () {
        for (var i = 0; i < this.edgeList.length; i++) {
            var e = this.edgeList[i];
            if (e.visible) {
                e.setVisible(false);
            }
        }
    };
    //////////////////////////////////////////////
    /////// Label's Functions ////////////////////
    //////////////////////////////////////////////
    Graph.prototype.showAllLabels = function (svgMode, bCola) {
        this.hideAllLabels();
        for (var i = 0; i < this.nodeInfo.length; ++i) {
            if (this.nodeInfo[i]["label"]) {
                if (!svgMode) {
                    if (bCola) {
                        if (this.nodeHasNeighbors[i]) {
                            this.rootObject.add(this.nodeInfo[i]["label"]);
                        }
                    }
                    else {
                        this.rootObject.add(this.nodeInfo[i]["label"]);
                    }
                }
            }
        }
    };
    Graph.prototype.hideAllLabels = function () {
        for (var i = 0; i < this.nodeInfo.length; ++i) {
            if (this.nodeInfo[i]["label"]) {
                this.rootObject.remove(this.nodeInfo[i]["label"]);
            }
        }
    };
    Graph.prototype.setEdgeScale = function (scale) {
        this.edgeList.forEach(function (edge) {
            edge.setScale(scale);
        });
    };
    Graph.prototype.setNodesColor = function (colorArray) {
        if (!colorArray)
            return;
        if (colorArray.length != this.nodeMeshes.length) {
            throw "ERROR: ColorArray (" + colorArray.length + ") and NodeMeshes (" + this.nodeMeshes.length + ") do not match";
        }
        this.nodeCurrentColor = colorArray.slice(0); // clone the array
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].material.color.setHex(colorArray[i]);
        }
        // also reset edge color:
        if (this.colorMode === "node") {
            for (var i = 0; i < this.edgeList.length; i++) {
                var edge = this.edgeList[i];
                edge.isColorChanged = true;
            }
        }
    };
    Graph.prototype.getNodeColor = function (id) {
        return this.nodeMeshes[id].material.color.getHex();
    };
    Graph.prototype.setNodeColor = function (id, color) {
        this.nodeMeshes[id].material.color.setHex(color);
    };
    Graph.prototype.selectNode = function (id, svgMode, bCola) {
        if (!this.nodeInfo[id].isSelected) {
            this.nodeInfo[id].isSelected = true;
            var x = this.nodeMeshes[id].scale.x;
            var y = this.nodeMeshes[id].scale.y;
            var z = this.nodeMeshes[id].scale.z;
            this.nodeMeshes[id].scale.set(2 * x, 2 * y, 2 * z);
            if (this.allLabels == false) {
                //if (!svgMode) this.rootObject.add(this.nodeLabelList[id]);
                if (!svgMode) {
                    if (bCola) {
                        if (this.nodeHasNeighbors[id]) {
                            this.rootObject.add(this.nodeInfo[id]["label"]);
                        }
                    }
                    else {
                        this.rootObject.add(this.nodeInfo[id]["label"]);
                    }
                }
            }
            for (var j = 0; j < this.edgeMatrix.length; ++j) {
                var edge = (this.edgeMatrix[id][j]) ? this.edgeMatrix[id][j] : this.edgeMatrix[j][id];
                if (edge) {
                    if (edge.visible == true) {
                        //edge.setColor(this.nodeMeshes[nodeID].material.color.getHex());
                        edge.multiplyScale(2);
                    }
                }
            }
        }
    };
    Graph.prototype.deselectNode = function (id) {
        if (this.nodeInfo[id].isSelected && this.commonData.selectedNode != id) {
            this.nodeInfo[id].isSelected = false;
            var x = this.nodeMeshes[id].scale.x;
            var y = this.nodeMeshes[id].scale.y;
            var z = this.nodeMeshes[id].scale.z;
            this.nodeMeshes[id].scale.set(0.5 * x, 0.5 * y, 0.5 * z);
            if (this.allLabels == false) {
                this.rootObject.remove(this.nodeInfo[id]["label"]);
            }
            for (var j = 0; j < this.edgeMatrix.length; ++j) {
                var edge = (this.edgeMatrix[id][j]) ? this.edgeMatrix[id][j] : this.edgeMatrix[j][id];
                if (edge) {
                    if (edge.visible == true) {
                        edge.multiplyScale(0.5);
                    }
                }
            }
        }
    };
    Graph.prototype.update = function () {
        var weightEdges = this.edgeThicknessByWeight;
        this.edgeList.forEach(function (edge) {
            edge.update(weightEdges);
        });
    };
    // Remove self from the scene so that the object can be GC'ed
    Graph.prototype.destroy = function () {
        this.parentObject.remove(this.rootObject);
    };
    return Graph;
}());
var Edge = (function () {
    function Edge(parentObject, sourceNode, targetNode, weight) {
        this.weight = weight;
        this.visible = true;
        // unit shape
        this.unitRadius = 0.5;
        this.unitLength = 2;
        // edge's width
        this.baseScale = 1;
        this.scaleWeight = 0.5 * this.baseScale;
        this.scaleNoWeight = this.baseScale;
        this.isColorChanged = false;
        this.timeTracker = new Date().getMilliseconds();
        this.parentObject = parentObject;
        this.targetNode = targetNode;
        this.sourceNode = sourceNode;
        this.directionMode = "none";
        this.color = "#cfcfcf";
        this.uniforms = {
            timeTracker: { type: "f", value: this.timeTracker / 1000 },
            isAnimationOn: { type: "i", value: 0 },
            startPos: { type: "v3", value: sourceNode.position },
            endPos: { type: "v3", value: targetNode.position },
            startColor: { type: "v4", value: new THREE.Vector4(1.0, 0, 0, 1.0) },
            endColor: { type: "v4", value: new THREE.Vector4(0, 0, 1.0, 1.0) },
            startOpacity: { type: "f", value: 0.95 },
            endOpacity: { type: "f", value: 0.95 }
        };
        this.vertexShader =
            "uniform int isAnimationOn;" +
                "uniform float startOpacity, endOpacity, timeTracker;" +
                "uniform vec3 startPos, endPos;" +
                "uniform vec4 startColor, endColor;" +
                "varying vec3 vPosition;" +
                "void main() {" +
                "	vec4 tmp = modelMatrix * vec4(position,1.0);" +
                "   vPosition = position;" +
                "	gl_Position = 	projectionMatrix *" +
                "			modelViewMatrix *" +
                " 			vec4(position, 1.0);" +
                "}";
        this.fragmentShader =
            "uniform int isAnimationOn;" +
                "uniform float startOpacity, endOpacity, timeTracker;" +
                "uniform vec3 startPos, endPos;" +
                "uniform vec4 startColor, endColor;" +
                "varying vec3 vPosition;" +
                "void main() {" +
                "   vec3 hilightPoint = startPos +( (endPos - startPos)  * timeTracker);" +
                "	float distance2End = distance(vPosition, endPos);" +
                "	float distance2Start = distance(vPosition, startPos);" +
                " 	float sum = distance2End + distance2Start;" +
                "   vec4 color;" +
                "   if( isAnimationOn == 1 &&  distance(hilightPoint,vPosition) < distance(startPos, endPos) * 0.3){" +
                "       color = vec4(1, 0, 0, 1);" +
                "   }else{" +
                "	    color = vec4( startColor.x * (distance2Start/sum) + endColor.x * (distance2End/sum)," +
                " 				startColor.y * (distance2Start/sum) + endColor.y * (distance2End/sum)," +
                "				startColor.z * (distance2Start/sum) + endColor.z * (distance2End/sum)," +
                "				startOpacity * (distance2Start/sum) + endOpacity * (distance2End/sum)" +
                "			);" +
                "   }" +
                "	gl_FragColor = color;" +
                "}";
        this.initializeCylinder();
        this.shape.isEdge = true; // A flag to identify the edge
        parentObject.add(this.shape);
        var w = (Math.ceil(weight * 10) - 6) * 0.5; // the edge scale is not proportional to edge weight
        if (w < 0)
            w = 0;
        this.scaleWeight += w;
    }
    Edge.prototype.getWeight = function () {
        return this.weight;
    };
    Edge.prototype.toggleArrow = function (show) {
        this.pointer.visible = show;
    };
    Edge.prototype.initializeCylinder = function () {
        this.geometry = new THREE.CylinderGeometry(this.unitRadius, this.unitRadius, this.unitLength, 12);
        this.cone = new THREE.CylinderGeometry(this.unitRadius, this.unitRadius * 3, this.unitLength / 5, 12);
        // Material 
        // using local positions 
        this.uniforms.startPos.value = new THREE.Vector3(0, this.unitLength / 2, 0);
        this.uniforms.endPos.value = new THREE.Vector3(0, -this.unitLength / 2, 0);
        this.uniforms.startColor.value = new THREE.Vector4(1.0, 0, 0, 1.0);
        this.uniforms.endColor.value = new THREE.Vector4(0, 0, 1.0, 1.0);
        var material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            transparent: true,
            depthWrite: false
        });
        this.shape = new THREE.Mesh(this.geometry, material);
        this.shape.renderDepth = 3; // Draw line BEFORE transparent brain model is drawn
        this.pointer = new THREE.Mesh(this.cone, new THREE.MeshBasicMaterial({
            color: 0x000000
        }));
        this.pointer.position = new THREE.Vector3(0, this.unitLength * 2 / 5, 0);
        this.pointer.visible = false;
        this.shape.add(this.pointer);
    };
    Edge.prototype.initializeLine = function () {
        this.geometry = new THREE.Geometry();
        this.geometry.vertices.push(new THREE.Vector3(0, this.unitLength / 2, 0), new THREE.Vector3(0, -this.unitLength / 2, 0));
        this.cone = new THREE.CylinderGeometry(this.unitRadius, this.unitRadius * 3, this.unitLength / 5, 12);
        // Material 
        // using local positions 
        this.uniforms.startPos.value = new THREE.Vector3(0, this.unitLength / 2, 0);
        this.uniforms.endPos.value = new THREE.Vector3(0, -this.unitLength / 2, 0);
        this.uniforms.startColor.value = new THREE.Vector4(1.0, 0, 0, 1.0);
        this.uniforms.endColor.value = new THREE.Vector4(0, 0, 1.0, 1.0);
        var material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            transparent: true,
            depthWrite: false
        });
        this.shape = new THREE.Line(this.geometry, material);
        this.shape.renderDepth = 3; // Draw line BEFORE transparent brain model is drawn
        this.pointer = new THREE.Mesh(this.cone, new THREE.MeshBasicMaterial({
            color: 0x000000
        }));
        this.pointer.position = new THREE.Vector3(0, this.unitLength * 2 / 5, 0);
        this.pointer.visible = false;
        this.shape.add(this.pointer);
    };
    Edge.prototype.setOpacity = function (startOpacity, endOpacity) {
        this.uniforms.startOpacity.value = startOpacity;
        this.uniforms.endOpacity.value = endOpacity;
    };
    Edge.prototype.updateColor = function () {
        this.isColorChanged = false;
        // Overwriter current color setting if directionMode is gradient
        if (this.directionMode === "gradient") {
            var startRGB = CommonUtilities.hexToRgb(saveObj.edgeSettings.directionStartColor, 1.0);
            var endRGB = CommonUtilities.hexToRgb(saveObj.edgeSettings.directionEndColor, 1.0);
            this.uniforms.startColor.value = new THREE.Vector4(startRGB.r / 255, startRGB.g / 255, startRGB.b / 255, 1.0);
            this.uniforms.endColor.value = new THREE.Vector4(endRGB.r / 255, endRGB.g / 255, endRGB.b / 255, 1.0);
            return;
        }
        if (this.colorMode === "weight" || this.colorMode === "none") {
            var color = new THREE.Color(this.color);
            this.uniforms.startColor.value = new THREE.Vector4(color.r, color.g, color.b, 1.0);
            this.uniforms.endColor.value = new THREE.Vector4(color.r, color.g, color.b, 1.0);
        }
        else if (this.colorMode === "node") {
            var sourceColor = new THREE.Color("#" + this.sourceNode.material.color.getHexString());
            var targetColor = new THREE.Color("#" + this.targetNode.material.color.getHexString());
            this.uniforms.startColor.value = new THREE.Vector4(sourceColor.r, sourceColor.g, sourceColor.b, 1.0);
            this.uniforms.endColor.value = new THREE.Vector4(targetColor.r, targetColor.g, targetColor.b, 1.0);
        }
    };
    Edge.prototype.getColor = function () {
        return this.color;
    };
    Edge.prototype.setScale = function (scale) {
        this.baseScale = scale;
        this.scaleNoWeight = this.baseScale;
        this.scaleWeight = this.baseScale * 0.5;
        var w = (Math.ceil(this.weight * 10) - 6) * 0.5; // the edge scale is not proportional to edge weight
        if (w < 0)
            w = 0;
        this.scaleWeight += w;
    };
    Edge.prototype.multiplyScale = function (s) {
        this.scaleWeight *= s;
        this.scaleNoWeight *= s;
    };
    Edge.prototype.setVisible = function (flag) {
        if (flag) {
            if (!this.visible) {
                this.parentObject.add(this.shape);
                this.visible = true;
            }
        }
        else {
            if (this.visible) {
                this.parentObject.remove(this.shape);
                this.visible = false;
            }
        }
    };
    Edge.prototype.update = function (weightEdges) {
        // update animation time
        this.timeTracker = new Date().getMilliseconds();
        this.uniforms.timeTracker.value = this.timeTracker / 1000;
        this.geometry.verticesNeedUpdate = true;
        var scale = 1;
        /* update width of the edge */
        if (weightEdges == true) {
            scale = this.scaleWeight;
        }
        else {
            scale = this.scaleNoWeight;
        }
        /* draw the cylinder? (check the code again) */
        var a = this.sourceNode.position, b = this.targetNode.position;
        var m = new THREE.Vector3();
        m.addVectors(a, b).divideScalar(2);
        this.shape.position = m;
        var origVec = new THREE.Vector3(0, 1, 0); //vector of cylinder
        var targetVec = new THREE.Vector3();
        targetVec.subVectors(b, a);
        var length = targetVec.length();
        if (length === 0) {
            this.parentObject.remove(this.shape);
            return;
        }
        this.shape.scale.set(scale, length / this.unitLength, scale);
        targetVec.normalize();
        var angle = Math.acos(origVec.dot(targetVec));
        var axis = new THREE.Vector3();
        axis.crossVectors(origVec, targetVec);
        axis.normalize();
        var quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(axis, angle);
        this.shape.quaternion = quaternion;
        /* update color of the edge */
        if (this.isColorChanged) {
            if (this.colorMode === "weight") {
                this.color = this.colorMapFunction(this.weight);
            }
            else {
                this.color = "#cfcfcf";
            }
            this.updateColor();
        }
    };
    return Edge;
}());
