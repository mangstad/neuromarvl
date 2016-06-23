
class Graph2D {
    id: number;
    jDiv;
    dataSet: DataSet;

    svg;
    svgDefs;
    svgNodeBundleArray;
    svgAllElements;

    d3Zoom;

    // Menu Options
    graph2DClass;
    graph2DDotClass;
    isFlowLayoutOn;
    edgeDirectionMode;
    edgeColorMode;

    mouseDownEventListenerAdded;
    groupNodesBy = "none";

    // Data
    commonData;


    // Layout
    cola2D

    // edge 
    isEdgeColorChanged: boolean = false;
    colorMode: string;
    directionMode: string;
    edgeLengthScale;
    edgeBaseLength;


    nodes: any[];
    links: any[];

    constructor(id: number, jDiv, dataSet: DataSet, svg, svgDefs, svgGroup, d3Zoom, commonData) {


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
    toggleDirectionArrow(isShown: boolean) {
        if (isShown) {
            this.svgAllElements.selectAll(".link")
                .style("marker-end", "url(#arrowhead-2d)");
        } else {
            this.svgAllElements.selectAll(".link")
                .style("marker-end", "none");
        }
    }
    menuButtonOnClick() {
        var l = $('#button-graph2d-option-menu-' + this.id).position().left + 5;
        var t = $('#button-graph2d-option-menu-' + this.id).position().top - $('#div-graph2d-layout-menu-' + this.id).height() - 15;


        $('#div-graph2d-layout-menu-' + this.id).zIndex(1000);
        $('#div-graph2d-layout-menu-' + this.id).css({ left: l, top: t, height: 'auto' });
        $('#div-graph2d-layout-menu-' + this.id).fadeToggle('fast');
    }

    setupOptionMenuUI() {
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
        var varLayoutOnChange = (isOn) => {
            this.isFlowLayoutOn = isOn;
            this.settingOnChange();
        };
        var varEdgeLengthOnChange = () => {
            var edgeLengthScale = $("#div-edge-length-slider-" + this.id)['bootstrapSlider']().data('bootstrapSlider').getValue();
            this.edgeLengthScale = edgeLengthScale;
            this.settingOnChange();
        };

        var varGroupNodesOnChange = (groupBy) => {
            this.groupNodesBy = groupBy;
            this.settingOnChange();
        }

        var varMenuButtonOnClick = () => { this.menuButtonOnClick(); };

        // Setting Options
        // option button
        this.jDiv.append($('<button id="button-graph2d-option-menu-' + this.id + '" class="' + this.graph2DClass + ' btn  btn-sm btn-primary" ' +
                'data-toggle="tooltip" data-placement="top" title="Show side-by-side graph representation">Options</button>')
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
            document.addEventListener('mouseup', (event) => {
                if ((!$(event.target).hasClass(varClass))) {
                    $('#div-graph2d-layout-menu-' + this.id).hide();

                }
            }, false);
        }
    }

    // Convert dataset to D3-compatible format
    initSVGGraph(colaGraph: Graph3D, camera) {
        this.colorMode = colaGraph.colorMode;
        this.directionMode = colaGraph.edgeDirectionMode;
        var width = this.jDiv.width();
        var height = this.jDiv.height() - sliderSpace;
        var widthHalf = width / 2;
        var heightHalf = height / 2;
        var screenCoords = new THREE.Vector3();
        var unitRadius = 5;

        // Reset nodes and links
        this.nodes.splice(0, this.nodes.length);
        this.links.splice(0, this.links.length);

        var children = colaGraph.nodeMeshes;

        // Add Nodes to SVG graph (Positions are based on the projected position of the 3D graphs
        for (var i = 0; i < children.length; i++) {
            var obj = children[i];
            var d = obj.userData;

            var nodeObject = new Object();
            nodeObject["id"] = d.id;
            if (this.dataSet.brainLabels) {
                nodeObject["label"] = this.dataSet.brainLabels[d.id];
            }
            nodeObject["color"] = "#".concat(colaGraph.nodeMeshes[d.id].material.color.getHexString());
            nodeObject["radius"] = colaGraph.nodeMeshes[d.id].scale.x * unitRadius;

            // for every attributes
            for (var j = 0; j < this.dataSet.attributes.columnNames.length; j++) {

                var colname = this.dataSet.attributes.columnNames[j];
                var value = this.dataSet.attributes.get(colname)[d.id];
                nodeObject[colname] = value;

                // add a special property for module id
                if (colname == 'module_id') {
                    nodeObject['moduleID'] = this.dataSet.attributes.get(colname)[d.id];
                }

                //  Get domain of the attributes (assume all positive numbers in the array)
                var columnIndex = this.dataSet.attributes.columnNames.indexOf(colname);
                var min = this.dataSet.attributes.getMin(columnIndex);
                var max = this.dataSet.attributes.getMax(columnIndex);

                // Scale value to between 0.05 to 1 
                var attrMap = d3.scale.linear().domain([min, max]).range([0.05, 1]);
                var scalevalue = attrMap(Math.max.apply(Math, value));
                nodeObject['scale_' + colname] = scalevalue;

                if (dataSet.attributes.info[colname].isDiscrete) { // if the attribute is discrete
                    // Scale to group attirbutes 
                    var values = this.dataSet.attributes.info[colname].distinctValues;
                    nodeObject['bundle_group_' + colname] = values.indexOf(value.indexOf(Math.max.apply(Math, value)));

                } else { // if the attribute is continuous
                    // Scale to group attirbutes 
                    var bundleGroupMap = d3.scale.linear().domain([min, max]).range([0, 9.99]); // use 9.99 instead of 10 to avoid a group of a single element (that has the max attribute value)
                    var bundleGroup = bundleGroupMap(Math.max.apply(Math, value)); // group
                    bundleGroup = Math.floor(bundleGroup);
                    nodeObject['bundle_group_' + colname] = bundleGroup;
                }
            }
            (<any>screenCoords).setFromMatrixPosition(obj.matrixWorld);
            screenCoords.project(camera);

            screenCoords.x = (screenCoords.x * widthHalf) + widthHalf;
            screenCoords.y = - (screenCoords.y * heightHalf) + heightHalf;
            nodeObject["x"] = screenCoords.x;
            nodeObject["y"] = screenCoords.y;

            this.nodes.push(nodeObject);
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
                    if (this.nodes[j].id == edge.sourceNode.userData.id) {
                        linkObject["source"] = this.nodes[j];
                        linkObject["x1"] = this.nodes[j].x;
                        linkObject["y1"] = this.nodes[j].y;
                    }
                    if (this.nodes[j].id == edge.targetNode.userData.id) {
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
    }

    initSVGElements() {
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
                } else if (l.source.color === l.target.color && edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode === "node") {
                    return l.color = l.source.color;
                }

                if (edgeDirectionMode === "opacity") {
                    sourceOpacity = 0;
                    targetOpacity = 1;
                }

                if (edgeDirectionMode === "gradient") {
                    var sourceColor = (String)(saveObj.edgeSettings.directionStartColor);
                    var targetColor = (String)(saveObj.edgeSettings.directionEndColor);
                } else if (edgeColorMode === "node") {
                    var sourceColor = String(l.source.color);
                    var targetColor = String(l.target.color);
                } else {
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
                } else {
                    var x1 = "0%";
                    var x2 = "0%";
                }

                if (box.height > 5) {
                    var y1 = (Number((this.getAttribute("y1")) - box.y) / box.height) * 100 + "%";
                    var y2 = (Number((this.getAttribute("y2")) - box.y) / box.height) * 100 + "%";
                } else {
                    var y1 = "0%";
                    var y2 = "0%";
                }


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

        var varMouseOveredSetNodeID = (id) => { this.mouseOveredSetNodeID(id); }
        var varMouseOutedSetNodeID = () => { this.mouseOutedSetNodeID(); }

        var varMouseOveredNode = (d) => { this.mouseOveredNode(d); }
        var varMouseOutedNode = (d) => { this.mouseOutedNode(d); }

        // Node pie chart
        var pie = d3.layout.pie();
        var dot = d3.svg.arc()
            .innerRadius(0)
            .outerRadius(5);

        var node = this.svgAllElements.selectAll(".node")
            .data(this.nodes)
            .enter().append("g")
            .attr("class", "node")
        //.attr("r", function (d) { return d.radius; })
            .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + " )"; })
        //.style("fill", function (d) { return d.color; })
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
                } else {
                    if (saveObj.nodeSettings.nodeColorMode === "discrete") {
                        var distincts = dataSet.attributes.info[colorAttr].distinctValues;
                        var colorMap = d3.scale.ordinal().domain(distincts).range(saveObj.nodeSettings.nodeColorDiscrete);
                    } else {
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
                        .attr("fill", function (d, i) { return color[i]; })
                        .style("stroke-width", 0)
                        .attr("d", dot);
                }

            });

        node.append("title")
            .text(function (d) { return d.id; });

        node.each(d=> d.width = d.height = d.radius * 2);

        this.svgAllElements.attr("transform", "translate(0,0)");
        this.d3Zoom.scale(1);
        this.d3Zoom.translate([0, 0]);

        
    }

    initSVGGraphWithoutCola(colaGraph: Graph3D) {
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

        var unitRadius = 5;

        this.nodes.splice(0, this.nodes.length);
        this.links.splice(0, this.links.length);

        var children = colaGraph.nodeMeshes;

        // Add Nodes to SVG graph (Positions are based on the projected position of the 3D graphs
        for (var i = 0; i < children.length; i++) {
            var d = children[i].userData;

            var nodeObject = new Object();
            nodeObject["id"] = d.id;
            nodeObject["color"] = "#".concat(colaGraph.nodeMeshes[d.id].material.color.getHexString());
            nodeObject["radius"] = colaGraph.nodeMeshes[d.id].scale.x * unitRadius;

            // for every attributes
            for (var j = 0; j < this.dataSet.attributes.columnNames.length; j++) {

                var colname = this.dataSet.attributes.columnNames[j];
                var value = this.dataSet.attributes.get(colname)[d.id];
                nodeObject[colname] = value;

                // add a special property for module id
                if (colname == 'module_id') {
                    nodeObject['moduleID'] = this.dataSet.attributes.get(colname)[d.id];
                }

                //  Get domain of the attributes (assume all positive numbers in the array)
                var columnIndex = this.dataSet.attributes.columnNames.indexOf(colname);
                var min = this.dataSet.attributes.getMin(columnIndex);
                var max = this.dataSet.attributes.getMax(columnIndex);

                // Scale value to between 0.05 to 1 
                var attrMap = d3.scale.linear().domain([min, max]).range([0.05, 1]);
                var scalevalue = attrMap(Math.max.apply(Math, value));
                nodeObject['scale_' + colname] = scalevalue;

                if (this.dataSet.attributes.info[colname].isDiscrete) { // if the attribute is discrete
                    // Scale to group attirbutes 
                    var values = this.dataSet.attributes.info[colname].distinctValues;
                    nodeObject['bundle_group_' + colname] = values.indexOf(value.indexOf(Math.max.apply(Math, value)));

                } else { // if the attribute is continuous
                    // Scale to group attirbutes 
                    var bundleGroupMap = d3.scale.linear().domain([min, max]).range([0, 9.99]); // use 9.99 instead of 10 to avoid a group of a single element (that has the max attribute value)
                    var bundleGroup = bundleGroupMap(Math.max.apply(Math, value)); // group
                    bundleGroup = Math.floor(bundleGroup);
                    nodeObject['bundle_group_' + colname] = bundleGroup;
                }
            }
            nodeObject["x"] = initX;
            nodeObject["y"] = initY;

            this.nodes.push(nodeObject);
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
                    if (this.nodes[j].id == edge.sourceNode.userData.id) {
                        linkObject["source"] = this.nodes[j];
                        linkObject["x1"] = this.nodes[j].x;
                        linkObject["y1"] = this.nodes[j].y;
                    }

                    if (this.nodes[j].id == edge.targetNode.userData.id) {
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

    }

    calculateLayout() {
        var calDiameter = function (x) {
            // Solve triangle number for n (hexagon diameter)
            return Math.floor((-1 + Math.sqrt(1 + 8*x))/2)
        }
        var radius = 10;
        var baseLength = this.edgeBaseLength;
        var lengthScale = this.edgeLengthScale;
        var groupBy = this.groupNodesBy;

        // calculate packing layout
        if (groupBy !== "none") {
            var circlePacking = d3.layout.pack()
                .sort(null)
                .radius(radius)
                .padding(1.5)
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
                } else {
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
                    groupMap[group] = { children: [], isSingle: isSingle};
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
                        if (typeof groupMap[rg] === "undefined") return;
                        groupLinkJson.push({
                            source: groupMap[g].index,
                            target: groupMap[rg].index,
                            value: 1
                        })
                    });
                    
                }
            }
            if (groupLinkJson.length === 0) {
                var linkMap = {};
                var nodes = this.nodes;
                this.links.forEach(function (v, i) {
                    if (v.source.groupID === v.target.groupID) return;

                    var linkID = "";
                    if (v.source.groupID > v.target.groupID) {
                        linkID = v.source.groupID + "-" + v.target.groupID;
                    } else {
                        linkID = v.target.groupID + "-" + v.source.groupID;
                    }

                    if (typeof linkMap[linkID] === "undefined") {
                        linkMap[linkID] = {
                            source: v.source.groupID,
                            target: v.target.groupID,
                            value: 1
                        }
                } else {
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
                })
            cola2D.start(30, 0, 30);

            // Translate Nodes to perspective group
            this.nodes.forEach(function (v, i) {
                v.x += groupJson[v.groupID].x;
                v.y += groupJson[v.groupID].y;
            });
        } else {

            var cola2D = colans.d3adaptor()
                .size([this.jDiv.width(), this.jDiv.height() - sliderSpace]);

            cola2D
                .handleDisconnected(true)
                .avoidOverlaps(true)
                .nodes(this.nodes)
                .links(this.links)
                .linkDistance(function () {
                    return lengthScale * baseLength;
                })

            if (this.isFlowLayoutOn) {
                    cola2D
                        .flowLayout('y', 10)
            }

            cola2D.start(30, 0, 30);

        }
    }

    settingOnChange() {
        var lengthScale = this.edgeLengthScale
        var baseLength = this.edgeBaseLength;
        var isOn = this.isFlowLayoutOn;
        var groupBy = this.groupNodesBy;

        var width = this.jDiv.width();
        var height = this.jDiv.height() - sliderSpace;
        var widthHalf = width / 2;
        var heightHalf = height / 2;
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
    }

    updateLabels(isShownLabel: boolean) {
        if (isShownLabel) {
            this.svgAllElements.selectAll(".nodeLabel")
                .style("visibility", "visible");
        }
        else {
            this.svgAllElements.selectAll(".nodeLabel")
                .style("visibility", "hidden");
        }
    }

    mouseOveredSetNodeID(id) {
        this.commonData.nodeIDUnderPointer[4] = id;
    }

    

    mouseOutedSetNodeID() {
        this.commonData.nodeIDUnderPointer[4] = -1;
    }

    mouseOutedNode(d) {
        var selectedID = this.commonData.selectedNode;
        if (selectedID == -1) {
            this.svgAllElements.selectAll(".link")
                .style("stroke-width", "1px")
                .style("stroke-opacity", 1);

            this.svgAllElements.selectAll(".node")
                .style("opacity", 1);

        } else {
            // Reseting All nodes source and target
            this.svgAllElements.selectAll(".node")
                .each(function (n) { n.target = n.source = false; }); // For every node in the graph

            var varEdgeColorMode = this.edgeColorMode;
            this.svgAllElements.selectAll(".link")
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

           
            this.svgAllElements.selectAll(".node")
                .style("opacity", function (n) {
                    if (n.target || n.source) {
                        return 1;
                    } else {
                        return 0.2;
                    }
                });;

        }

    }

    mouseOveredNode(d) { // d: contain the node's info 

        var selectedID = this.commonData.selectedNode;

        // Reseting All nodes source and target
        this.svgAllElements.selectAll(".node")
            .each(function (n,i) {
                n.index = i;
                n.target = n.source = false;
            }); // For every node in the graph

        var varEdgeColorMode = this.edgeColorMode;
        this.svgAllElements.selectAll(".link")
            .style("stroke-width", function (l) {
                // if the link is associated with the selected node in anyway (source or target)
                if (l.target.id === d.id) { l.target.source = true; l.source.target = true; }
                if (l.source.id === d.id) { l.source.source = true; l.target.target = true; }
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

        this.svgAllElements.selectAll(".node")
            .style("opacity", function (n) {
                if (n.target || n.source) {
                    return 1;
                } else {
                    return 0.2;
                }
            });
        }


    clear() {
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
    }

    updateEdgeColorMode(colorMode: string) {
        this.isEdgeColorChanged = true;
        this.colorMode = colorMode;
    }


    updateEdgeDirectionMode(directionMode: string) {
        if (this.directionMode === directionMode) return;
        // remove old direction mode 
        if (this.directionMode === "arrow") {
            this.toggleDirectionArrow(false);
        } else if (this.directionMode === "ansimation") {
            // ignore
        } else if (this.directionMode === "opacity") {
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

        this.directionMode = directionMode;
        this.isEdgeColorChanged = true;
    }

    updateEdgeColor() {
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
                } else if (l.source.color === l.target.color && edgeDirectionMode !== "opacity" && edgeDirectionMode !== "gradient" && edgeColorMode === "node") {
                    return l.color = l.source.color;
                }

                if (edgeDirectionMode === "opacity") {
                    sourceOpacity = 0;
                    targetOpacity = 1;
                }

                if (edgeDirectionMode === "gradient") {
                    var sourceColor = (String)(saveObj.edgeSettings.directionStartColor);
                    var targetColor = (String)(saveObj.edgeSettings.directionEndColor);
                } else if (edgeColorMode === "node") {
                    var sourceColor = String(l.source.color);
                    var targetColor = String(l.target.color);
                } else {
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
                } else {
                    var x1 = "0%";
                    var x2 = "0%";
                }

                if (box.height > 5) {
                    var y1 = (Number((this.getAttribute("y1")) - box.y) / box.height) * 100 + "%";
                    var y2 = (Number((this.getAttribute("y2")) - box.y) / box.height) * 100 + "%";
                } else {
                    var y1 = "0%";
                    var y2 = "0%";
                }


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

        this.isEdgeColorChanged = false;
    }

    // NOTE: THIS USED TO BE ANIMATED. WE REMOVED THE ANIMATION SO THE "TRANSITION" CODE IS A KINDA POINTLESS ZERO DURATION ONE.
    transitionalUpdate() {

        var offsetx = 250;
        var offsety = 0;

        var node = this.svgAllElements.selectAll(".node").data(this.nodes);
        this.nodes.forEach(d=> {
        });
        node.each(d=> {
            d.x += offsetx;
            d.y += offsety;
        });
        node.each(d=> d.width = d.height = d.radius * 2);
        node.transition().duration(0) // zero duration; don't animate
            .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + " )"; });

        var link = this.svgAllElements.selectAll(".link").data(this.links)
        var nodes = this.nodes;
        link.transition().duration(0)
            .attr("x1", function (d) {
                if (typeof d.source === "object") {
                    return d.source.x;
                } else {
                    return nodes[d.source].x;
                }
            })
            .attr("y1", function (d) {
                if (typeof d.source === "object") {
                    return d.source.y;
                } else {
                    return nodes[d.source].y;
                }
            })
            .attr("x2", function (d) {
                if (typeof d.target === "object") {
                    return d.target.x;
                } else {
                    return nodes[d.target].x;
                }
            })
            .attr("y2", function (d) {
                if (typeof d.target === "object") {
                    return d.target.y;
                } else {
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
    }

    update(colaGraph: Graph3D, isShownLabel: boolean) {

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

                } else {

                    if (saveObj.nodeSettings.nodeColorMode === "discrete") {
                        var distincts = dataSet.attributes.info[colorAttr].distinctValues;
                        var colorMap = d3.scale.ordinal().domain(distincts).range(saveObj.nodeSettings.nodeColorDiscrete);
                    } else {
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
    }
}
