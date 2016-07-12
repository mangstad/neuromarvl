
class CircularGraph {
    id: number;
    jDiv;
    dataSet: DataSet;
    svg;
    svgDefs;
    svgNodeBundleArray;
    svgAllElements;
    d3Zoom;


    // Common Data
    commonData;
    colaGraph: Graph3D;
    saveObj;

    // Circular Only data
    nodes;
    links;

    // Save html elements
    circularBar1ColorPicker;
    circularBar2ColorPicker;

    // Node
    isDisplayAllNode = false;

    // Bar
    BAR_MAX_HEIGHT = 8; // Bar-height = Rectangle width
    BAR_WIDTH_RATIO = 40;

    attributeBars = [];
    numBars = 0;
    numBarsActive = 0;
    circularBarColorChange: boolean = false;
    circularBarWidthChange: boolean = false;

    CIRCULAR_LINK_HILIGHT_COLOR = "#d62728";
    CIRCULAR_LINK_DEFAULT_COLOR = "#3498db";
    circularCSSClass: string;
    circularDotCSSClass: string;
    circularBundleAttribute: string;
    circularSortAttribute: string;
    circularLableAttribute: string;

    circularEdgeColorMode: string;
    circularEdgeDirectionMode: string;
    circularMouseDownEventListenerAdded = false;



    constructor(id: number, jDiv, dataSet: DataSet, svg, svgDefs, svgGroup, d3Zoom, commonData, saveObj) {
        this.id = id;
        this.jDiv = jDiv;
        this.dataSet = dataSet;
        this.svg = svg;
        this.svgDefs = svgDefs;
        this.svgAllElements = svgGroup;
        this.d3Zoom = d3Zoom;
        this.commonData = commonData;
        this.saveObj = saveObj;

        this.circularBundleAttribute = "none";
        this.circularSortAttribute = "none";
        this.circularLableAttribute = "label";
    }

    setDataSet(dataSet: DataSet) {
        this.dataSet = dataSet;
    }

    setColaGraph(colaGraph: Graph3D) {
        this.colaGraph = colaGraph;
    }

    clear() {
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
    }

    // Define UI components of the settings 
    setupOptionMenuUI() {

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
        var varCircularLayoutLabelOnChange = (s: string) => { this.circularLayoutLabelOnChange(s); };
        var varCircularLayoutAttributeOneOnChange = (barID: number, s: string) => { this.circularLayoutAttributeOnChange(barID, s); };
        var varCircularLayoutSortOnChange = (s: string) => { this.circularLayoutSortOnChange(s); };
        var varCircularLayoutBundleOnChange = (s: string) => { this.circularLayoutBundleOnChange(s); };
        var varCircularLayoutHistogramButtonOnClick = () => { this.circularLayoutHistogramButtonOnClick(); };
        var varCircularAddMoreButtonOnClick = () => { this.addAttributeBar(); }
        var varCircularDisplayAllNodeOnCheck = (isChecked) => {
            this.isDisplayAllNode = isChecked;
            this.clear();
            this.create();
        };
        // Setting Options

        // option button
        this.jDiv.append($('<button id="button-circular-layout-histogram-' + this.id + '" class="' + this.circularCSSClass + ' btn  btn-sm btn-primary" ' +
                'data-toggle="tooltip" data-placement="top" title="Show side-by-side graph representation">Options</button>')
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
        var option: HTMLOptionElement;
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
            document.addEventListener('mouseup', (event) => {
                let menu = document.getElementById("div-circular-layout-menu-" + this.id);
                if ((!$(event.target).hasClass(varClass))
                    && !$.contains(menu, <Element>(event.target))
                    && !this.circularBarColorChange)
                {
                    $('#div-circular-layout-menu-' + this.id).hide();
                }

                this.circularBarColorChange = false;
            }, false);
        }

    }

    toggleDirectionArrow(isShown: boolean) {
        if (isShown) {
            this.svgAllElements.selectAll(".linkCircular")
                .style("marker-mid", "url(#arrowhead-circular)");
        } else {
            this.svgAllElements.selectAll(".linkCircular")
                .style("marker-mid", "none");
        }
    }

    create() {
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

    }

    update() {
        if (!this.colaGraph) {
            return;
        }

        let attrSort = $('#select-circular-layout-sort-' + this.id).val();
        let attrBundle = $('#select-circular-layout-bundle-' + this.id).val();

        let attributes = this.dataSet.attributes;
        let edgeSettings = this.saveObj.edgeSettings;
        let nodeSettings = this.saveObj.nodeSettings;

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
                        if (this.svgNodeBundleArray[j].id == edge.sourceNode.userData.id) {
                            this.svgNodeBundleArray[j].linkColors[edge.targetNode.userData.id] = edge.color;
                        }
                        // If this node is the Target of the link
                        if (this.svgNodeBundleArray[j].id == edge.targetNode.userData.id) {
                            this.svgNodeBundleArray[j].linkColors[edge.sourceNode.userData.id] = edge.color;
                        }
                    }
                }
            }
        }

        //------------------------------------------------------------------------------------------------
        // Generate updated data
        var nodeJson = JSON.parse(JSON.stringify(this.svgNodeBundleArray));     // Is this really happening?
        var bundle = d3.layout.bundle();
        var diameter = 800,
            radius = diameter / 2,
            innerRadius = radius - 120;

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
            } else {
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
                } else if (l.source.color === l.target.color && edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode === "node") {
                    return l.color = "#" + l.source.color;
                }

                if (edgeDirectionMode === "gradient") {
                    var sourceColor = (String)(edgeSettings.directionStartColor);
                    var targetColor = (String)(edgeSettings.directionEndColor);
                } else if (edgeColorMode === "node") {
                    var sourceColor = String(l.source.color);
                    var targetColor = String(l.target.color);
                } else {
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

                if ($("#" + id)[0]) $("#" + id)[0]["remove"]();
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
                        if (attrs.hasOwnProperty(attr)) stop.setAttribute(attr, attrs[attr]);
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
                //TODO: Colour conversion is already done elsewhere. Pass it to the graph so it doesn't need to be repeated for every node

                var colorAttr = nodeSettings.nodeColorAttribute;
                var attrArray = attributes.get(colorAttr);
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

                if (nodeSettings.nodeColorMode === "discrete") {
                    var distincts = attributes.info[colorAttr].distinctValues;
                    var colorMap = d3.scale.ordinal().domain(distincts).range(nodeSettings.nodeColorDiscrete);
                } else {
                    var columnIndex = attributes.columnNames.indexOf(colorAttr);
                    var min = attributes.getMin(columnIndex);
                    var max = attributes.getMax(columnIndex);
                    var minColor = nodeSettings.nodeColorContinuousMin;
                    var maxColor = nodeSettings.nodeColorContinuousMax;
                    var colorMap = d3.scale.linear().domain([min, max]).range([minColor, maxColor]);
                }

                if (attributes.info[colorAttr].numElements === 1) {
                    var color = chartData[colorAttr].map(function (val) {
                        return colorMap(val).replace("0x", "#");
                    });
                } else {
                    var color = chartData[colorAttr].map(function (val, i) {
                        return colorMap(i).replace("0x", "#");
                    });
                }

                group.selectAll(".path")
                    .data(function () {
                        var tmp = chartData[colorAttr].map(function (val) { return val; });
                        if (tmp.length === 1 && tmp[0] === 0) {
                            return pie([1]);
                        } else {
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

    }

    // Generate data array for the graph 
    generateCircularData(bundleByAttribute: string) {
        if (!this.colaGraph) {
            console.log("ERROR: colaGraph is NULL");
            return;
        }

        this.svgNodeBundleArray = [];
        let children = this.colaGraph.nodeMeshes; // TODO: Need to be replaced with other objects!!
        let attributes = this.dataSet.attributes;
        let brainLabels = this.dataSet.brainLabels;

        // Loop through all nodes of the Cola Graph
        for (var i = 0; i < children.length; i++) {
            var d = children[i].userData;
            
            if (!this.isDisplayAllNode && !d.hasVisibleEdges) continue;

            // Create new empty node
            var nodeObject = new Object();
            nodeObject["id"] = d.id;

            if (brainLabels) {
                nodeObject["label"] = brainLabels[d.id];
            }

            // for every attributes
            for (var j = 0; j < attributes.columnNames.length; j++) {

                var colname = attributes.columnNames[j];
                var value = attributes.get(colname)[d.id];
                nodeObject[colname] = value;

                // add a special property for module id
                if (colname == 'module_id') {
                    nodeObject['moduleID'] = attributes.get(colname)[d.id];
                }

                //  Get domain of the attributes (assume all positive numbers in the array)
                var columnIndex = attributes.columnNames.indexOf(colname);
                var min = attributes.getMin(columnIndex);
                var max = attributes.getMax(columnIndex);

                // Scale value to between 0.05 to 1 
                var attrMap = d3.scale.linear().domain([min, max]).range([0.05, 1]);
                var scalevalue = attrMap(Math.max.apply(Math, value));
                nodeObject['scale_' + colname] = scalevalue;

                if (attributes.info[colname].isDiscrete) { // if the attribute is discrete
                    // Scale to group attirbutes 
                    var values = attributes.info[colname].distinctValues;
                    nodeObject['bundle_group_' + colname] = values.indexOf(Math.max.apply(Math, value));

                } else { // if the attribute is continuous
                    // Scale to group attirbutes 
                    var bundleGroupMap = d3.scale.linear().domain([min, max]).range([0, 9.99]); // use 9.99 instead of 10 to avoid a group of a single element (that has the max attribute value)
                    var bundleGroup = bundleGroupMap(Math.max.apply(Math, value)); // group
                    bundleGroup = Math.floor(bundleGroup);
                    nodeObject['bundle_group_' + colname] = bundleGroup;
                }
            }

            nodeObject["bundleByAttribute"] = bundleByAttribute;
            if (bundleByAttribute == "none") {
                nodeObject["name"] = "root." + d.id;
            } else {
                nodeObject["name"] = "root." + bundleByAttribute + nodeObject['bundle_group_' + bundleByAttribute] + "." + d.id;
            }
            
            nodeObject["color"] = this.colaGraph.nodeMeshes[d.id].material.color.getHexString();

            // Declare variables 
            nodeObject["imports"] = [];
            nodeObject["linkColors"] = [];
            nodeObject["barWidths"] = []; // used to calculate the position of the label for each bar
            this.svgNodeBundleArray.push(nodeObject);
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
                    if (this.svgNodeBundleArray[j].id == edge.sourceNode.userData.id) {
                        var moduleID = -1;
                        var bundleGroupID = -1;

                        // for every node in the array again (to find the target node of this link)
                        for (var k = 0; k < this.svgNodeBundleArray.length; k++) {
                            if (this.svgNodeBundleArray[k].id == edge.targetNode.userData.id) {

                                if (bundleByAttribute == "none") {
                                    moduleID = this.svgNodeBundleArray[k].moduleID;
                                    var nodeName = "root." + edge.targetNode.userData.id;
                                }
                                else {
                                    bundleGroupID = this.svgNodeBundleArray[k]['bundle_group_' + bundleByAttribute];
                                    var nodeName = "root." + bundleByAttribute + bundleGroupID + "." + edge.targetNode.userData.id;

                                }
                                this.svgNodeBundleArray[j].imports.push(nodeName); // add target nodes to this node
                                this.svgNodeBundleArray[j].linkColors[edge.targetNode.userData.id] = edge.color;
                                break;
                            }
                        }
                    }

                }
            }
        }
    }

    GenerateCircularUI(sortByAttribute: string, bundleByAttribute: string) {
        let attributes = this.dataSet.attributes;
        let edgeSettings = this.saveObj.edgeSettings;
        let nodeSettings = this.saveObj.nodeSettings;

        let nodeJson = JSON.parse(JSON.stringify(this.svgNodeBundleArray));

        let width = 250 + this.jDiv.width() / 2;
        let height = (this.jDiv.height() - sliderSpace) / 2;

        let diameter = 800,
            radius = diameter / 2,
            innerRadius = radius - 120;

        let cluster = d3.layout.cluster()
            .size([360, innerRadius])
            .sort(null) // Using built-in D3 sort destroy the order of the cluster => need to be investigated
            .value(function (d) {
                return 180;
            });


        let bundle = d3.layout.bundle();

        // Node pie chart
        let pie = d3.layout.pie();
        let dot = d3.svg.arc()
            .innerRadius(0)
            .outerRadius(5);

        // Link path
        let line = d3.svg.line.radial()
            //.tension(.85)
            .radius(function (d) {
                return d.y;
            })
            .angle(function (d) { return d.x / 180 * Math.PI; })
            .interpolate("bundle")
        ;

        this.svgAllElements.attr("transform", "translate(" + width + "," + height + ")");

        this.d3Zoom.scale(1);
        this.d3Zoom.translate([width, height]);

        // An alternative solutions to sorting the children while keeping 
        // the order of the clusters 
        let tree = packages.root(nodeJson);
        if (sortByAttribute !== "none") {
            var groups = tree.children[0].children;
            // If  bundle is none, the children are not put into groups
            if (bundleByAttribute !== "none") {
                for (var i = 0; i < groups.length; i++) {
                    groups[i].children.sort(function (a, b) {
                        return Math.max(a[sortByAttribute][0]) - Math.max(b[sortByAttribute][0]);
                    });
                }
            } else {
                for (var i = 0; i < groups.length; i++) {
                    groups.sort(function (a, b) {
                        return Math.max(a[sortByAttribute][0]) - Math.max(b[sortByAttribute][0]);
                    });
                }
            }
        }
        this.nodes = cluster.nodes(tree);
        this.links = packages.imports(this.nodes);

        var varMouseOveredSetNodeID = (id) => { this.mouseOveredSetNodeID(id); }
        var varMouseOutedSetNodeID = () => { this.mouseOutedSetNodeID(); }

        var varMouseOveredCircularLayout = (d) => { this.mouseOveredCircularLayout(d); }
        var varMouseOutedCircularLayout = (d) => { this.mouseOutedCircularLayout(d); }

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
                } else if (l.source.color === l.target.color && edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode === "node") {
                    return l.color = "#" + l.source.color;
                }

                if (edgeDirectionMode === "gradient") {
                    var sourceColor = (String)(edgeSettings.directionStartColor);
                    var targetColor = (String)(edgeSettings.directionEndColor);
                } else if (edgeColorMode === "node") {
                    var sourceColor = String(l.source.color);
                    var targetColor = String(l.target.color);
                } else {
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

                if ($("#" + id)[0]) $("#" + id)[0]["remove"]();
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
                        if (attrs.hasOwnProperty(attr)) stop.setAttribute(attr, attrs[attr]);
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
                var colorAttr = nodeSettings.nodeColorAttribute;
                var attrArray = attributes.get(colorAttr);
                var group = d3.select(this);
                group.selectAll("path").remove();
                if (colorAttr === "" || colorAttr === "none") {
                    group.selectAll(".path")
                        .data(pie([1]))
                        .enter().append('path')
                        .attr("fill", function (d, i) { return "#d3d3d3"; })
                        .attr("d", dot);

                    return;
                } else {
                    if (nodeSettings.nodeColorMode === "discrete") {
                        var distincts = attributes.info[colorAttr].distinctValues;
                        var colorMap = d3.scale.ordinal().domain(distincts).range(nodeSettings.nodeColorDiscrete);
                    } else {
                        var columnIndex = attributes.columnNames.indexOf(colorAttr);
                        var min = attributes.getMin(columnIndex);
                        var max = attributes.getMax(columnIndex);
                        var minColor = nodeSettings.nodeColorContinuousMin;
                        var maxColor = nodeSettings.nodeColorContinuousMax;
                        var colorMap = d3.scale.linear().domain([min, max]).range([minColor, maxColor]);
                    }
                    if (attributes.info[colorAttr].numElements === 1) {
                        var color = chartData[colorAttr].map(function (val) {
                            return colorMap(val).replace("0x", "#");
                        });
                    } else {
                        var color = chartData[colorAttr].map(function (val, i) {
                            return colorMap(i).replace("0x", "#");
                        });
                    }

                    group.selectAll(".path")
                        .data(function () {
                            var tmp = chartData[colorAttr].map(function (val) { return val; });
                            if (tmp.length === 1 && tmp[0] === 0) {
                                return pie([1]);
                            } else {
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

    }

    addAttributeBar() {
        let varMouseOveredSetNodeID = (id) => { this.mouseOveredSetNodeID(id); }
        let varMouseOutedSetNodeID = () => { this.mouseOutedSetNodeID(); }
        let varMouseOveredCircularLayout = (d) => { this.mouseOveredCircularLayout(d); }
        let varMouseOutedCircularLayout = (d) => { this.mouseOutedCircularLayout(d); }
        let varCircularLayoutAttributeOnChange = (barID: number, val: string) => { this.circularLayoutAttributeOnChange(barID, val); }
        let varUpdateCircularBarColor = (barID: number, color: string) => { this.updateCircularBarColor(barID, color); }

        let id = this.attributeBars.length;
        let bar = {
            id: id,
            color: "#bdc3c7", // default color
            attribute: "none", // default attribute
            isGradientOn: false
        }

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
        $('#div-circular-bar' + bar.id + '-' + this.id)
            .append($(`
                <div id="input-circular-layout-bar${bar.id}-color" class="${this.circularCSSClass} input-group colorpicker-component" style="width: 12em" >
                    <input type="text" value="bdc3c7" class="form-control"/>
                    <span class="input-group-addon"><i></i></span>
                </div>
                `)
        );
        let $pickerDiv = (<any>$(`#input-circular-layout-bar${bar.id}-color`));
        $pickerDiv.colorpicker();
        $pickerDiv.on("changeColor", e => varUpdateCircularBarColor(bar.id, (<any>e).color.toHex()));


        $('#select-circular-layout-attribute-' + bar.id + '-' + this.id).empty();

        var option = document.createElement('option');
        option.text = 'none';
        option.value = 'none';
        $('#select-circular-layout-attribute-' + bar.id + '-' + this.id).append(option);

        for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
            var columnName = this.dataSet.attributes.columnNames[i];
            $('#select-circular-layout-attribute-' + bar.id + '-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');
        }
    }

    // Differences between update and set circular bar color
    updateCircularBarColor(barID: number, color: string) {
        this.circularBarColorChange = true;

        // update bar object
        var bar = this.attributeBars[barID];
        bar.color = color;

        var gScale = 100;
        var r, g, b;
        var txt: string;
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

                    r += delta; if (r > 255) r = 255; if (r < 0) r = 0;
                    g += delta; if (g > 255) g = 255; if (g < 0) g = 0;
                    b += delta; if (b > 255) b = 255; if (b < 0) b = 0;

                    txt = b.toString(16); if (txt.length < 2) txt = "0" + txt;
                    txt = g.toString(16) + txt; if (txt.length < 4) txt = "0" + txt;
                    txt = r.toString(16) + txt; if (txt.length < 6) txt = "0" + txt;

                    return "#" + txt;
                });
        }
        else {
            this.svgAllElements.selectAll(".rect" + bar.id + "Circular")
                .style("fill", color);
        }


    }

    ////////////////////////////////////////////////////////////////
    ///////// Change in Graph Settings /////////////////////////////
    ////////////////////////////////////////////////////////////////

    updateAllAttributeBars() {
        var height = this.BAR_MAX_HEIGHT / this.numBarsActive;
        var count = 0;
        var BAR_MAX_HEIGHT = this.BAR_MAX_HEIGHT;

        for (var barIndex in this.attributeBars) {
            var b = this.attributeBars[barIndex];

            // check if the bar is active
            if (b.attribute !== "none") {

                this.svgAllElements.selectAll(".rect" + b.id + "Circular")
                // Change bar location
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
    }

    // Change on Attribute of bar
    circularLayoutAttributeOnChange(barID: number, attr: string) {
        var bar = this.attributeBars[barID];
        var height = this.BAR_MAX_HEIGHT / this.numBarsActive;
        var BAR_MAX_HEIGHT = this.BAR_MAX_HEIGHT;

        // update number of active bar
        if (bar.attribute == "none" && attr !== "none") {
            this.numBarsActive++;
            this.circularBarWidthChange = true;
        } else if (bar.attribute !== "none" && attr == "none") {
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
                    // Change bar location
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
                })
        } else {
            this.svgAllElements.selectAll(".rect" + bar.id + "Circular")
                .attr("width", function (d) {
                    d.barWidths[bar.id] = 0;
                    return 0;
                })
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

    }

    circularLayoutSortOnChange(attr: string) {
        this.circularSortAttribute = $('#select-circular-layout-sort-' + this.id).val();
        this.clear();
        this.create(); // recreate the graph
        //this.showNetwork(true); // Is there another way to update the graph without calling this function
    }

    circularLayoutBundleOnChange(attr: string) {
        this.circularBundleAttribute = $('#select-circular-layout-bundle-' + this.id).val();
        this.clear();
        this.create(); // recreate the graph
    }

    circularLayoutLabelOnChange(attr: string) {
        this.circularLableAttribute = attr;

        if (attr == "label") {
            this.svgAllElements.selectAll(".nodeCircular")
                .text(function (d) {
                    return d.label;
                });
        } else if (attr == "id") {
            this.svgAllElements.selectAll(".nodeCircular")
                .text(function (d) { return d.key; });
        } else {
            this.svgAllElements.selectAll(".nodeCircular")
                .text(function (d) { return d[attr]; });
        }
    }

    circularLayoutEdgeColorModeOnChange(mode: string) {
        this.circularEdgeColorMode = mode;
        this.update();
    }


    circularLayoutEdgeDirectionModeOnChange(directionMode: string) {
        if (this.circularEdgeDirectionMode === directionMode) return;
        // remove old direction mode
        if (this.circularEdgeDirectionMode === "arrow") {
            this.toggleDirectionArrow(false);
        } else if (this.circularEdgeDirectionMode === "ansimation") {
            // ignore
        } else if (this.circularEdgeDirectionMode === "opacity") {
            // ignore (handled by update method)
        }

        // Apply new direction mode
        if (directionMode === "arrow") {
            this.toggleDirectionArrow(true);
        } else if (directionMode === "animation") {
            // ignore
        } else if (directionMode === "opacity") {
            // ignore (handled by update method)
        }

        this.circularEdgeDirectionMode = directionMode;
        this.update();
    }


    ////////////////////////////////////////////////////////////////
    ///////// Mouse Interaction ////////////////////////////////////
    ////////////////////////////////////////////////////////////////

    mouseOveredSetNodeID(id) {
        this.commonData.nodeIDUnderPointer[4] = id;
    }

    mouseOutedSetNodeID() {
        this.commonData.nodeIDUnderPointer[4] = -1;
    }

    // Handle click on the Options
    circularLayoutHistogramButtonOnClick() {
        var l = $('#button-circular-layout-histogram-' + this.id).position().left + 5;
        var t = $('#button-circular-layout-histogram-' + this.id).position().top - $('#div-circular-layout-menu-' + this.id).height() - 15;

        for (var barIndex in this.attributeBars) {
            var bar = this.attributeBars[barIndex];
            if ($('#span-circular-layout-bar' + bar.id + '-color-picker').length > 0) {

                // saved in the object for future saving feature
                //bar.colorPicker = $('#span-circular-layout-bar'+ bar.id +'-color-picker').detach();
            }

            //$(bar.colorPicker).insertAfter('#select-circular-layout-attribute-'+ bar.id +'-' + this.id);
        }
        $('#div-circular-layout-menu-' + this.id).zIndex(1000);
        $('#div-circular-layout-menu-' + this.id).css({ left: l, top: t, height: 'auto' });
        $('#div-circular-layout-menu-' + this.id).fadeToggle('fast');
    }

    // When the mouse hovers the node's label
    mouseOveredCircularLayout(d) { // d: contain the node's info 

        var selectedID = this.commonData.selectedNode;

        // Reseting All nodes source and target
        this.svgAllElements.selectAll(".nodeCircular")
            .each(function (n) { n.target = n.source = false; }); // For every node in the graph

        var varEdgeColorMode = this.circularEdgeColorMode;
        this.svgAllElements.selectAll(".linkCircular")
            .style("stroke-width", function (l) {

                // if the link is associated with the selected node in anyway (source or target)
                if (l.target === d) { l.target.source = true; l.source.target = true; }
                if (l.source === d) { l.source.source = true; l.target.target = true; }
                if (l.source.id === selectedID) { l.source.source = true; l.target.target = true; }
                if (l.target.id === selectedID) { l.source.source = true; l.target.target = true; }

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
                } else {
                    return 0.2;
                }
            });

        this.svgAllElements.selectAll(".nodeCircular")
            .style("font-weight", function (n) {
                if ((n.target || n.source)) { // if the node has any direct relation to the selected node
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
                } else {
                    return 0.2;
                }
            });;

        this.svgAllElements.selectAll(".nodeDotCircular")
            .style("opacity", function (n) {
                if (n.target || n.source) {
                    return 1;
                } else {
                    return 0.2;
                }
            });;

        for (var barIndex in this.attributeBars) {
            var b = this.attributeBars[barIndex];
            // check if the bar is active
            if (b.attribute !== "none") {

                this.svgAllElements.selectAll(".rect" + b.id + "Circular")
                    .style("opacity", function (n) {
                        if (n.target || n.source) {
                            return 1;
                        } else {
                            return 0.2;
                        }
                    });
            }
        }
    }

    mouseOutedCircularLayout(d) {
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
        } else {
            // Reseting All nodes source and target
            this.svgAllElements.selectAll(".nodeCircular")
                .each(function (n) { n.target = n.source = false; }); // For every node in the graph

            var varEdgeColorMode = this.circularEdgeColorMode;
            this.svgAllElements.selectAll(".linkCircular")
                .style("stroke-width", function (l) {
                    // if the link is associated with the selected node in anyway (source or target)
                    if (l.source.id === selectedID) { l.source.source = true; l.target.target = true; }
                    if (l.target.id === selectedID) { l.source.source = true; l.target.target = true; }

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
                    } else {
                        return 0.2;
                    }
                });

            this.svgAllElements.selectAll(".nodeCircular")
                .style("font-weight", function (n) {
                    if ((n.target || n.source)) { // if the node has any direct relation to the selected node
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
                    } else {
                        return 0.2;
                    }
                });;

            this.svgAllElements.selectAll(".nodeDotCircular")
                .style("opacity", function (n) {
                    if (n.target || n.source) {
                        return 1;
                    } else {
                        return 0.2;
                    }
                });;

            for (var barIndex in this.attributeBars) {
                var b = this.attributeBars[barIndex];
                // check if the bar is active
                if (b.attribute !== "none") {

                    this.svgAllElements.selectAll(".rect" + b.id + "Circular")
                        .style("opacity", function (n) {
                            if (n.target || n.source) {
                                return 1;
                            } else {
                                return 0.2;
                            }
                        });
                }
            }
        }

    }
}
