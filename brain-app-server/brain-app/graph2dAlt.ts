

declare var cytoscape;

class Graph2DAlt {
    // UI
    graph2DAltDotClass: string;
    graph2DAltClass: string;

    // Options menu
    scale: number = 5;

    groupNodesBy = "none";
    colorMode: string;
    directionMode: string;
    mouseDownEventListenerAdded;
    layout = "cola";

    // Data
    config;

    nodes: any[];
    links: any[];

    // Style constants
    BASE_RADIUS = 5;
    BASE_EDGE_WEIGHT = 1.5;
    BASE_BORDER_WIDTH = 1;
    BASE_LABEL_SIZE = 4;

    cy;

    constructor(
        private id: number,
        private jDiv,
        private dataSet: DataSet,
        private container,
        private commonData: CommonData,
        private saveObj: SaveFile,
        private graph3d: Graph3D,
        private camera: THREE.Camera,
        complexity: number
    ) {
        this.nodes = [];
        this.links = [];
                
        // Use nice layout by default, but switch to faster alternative if graph is too complex
        if (complexity > 750) this.layout = "cose";
    }
    
    updateGraph() {
        CommonUtilities.launchAlertMessage(CommonUtilities.alertType.INFO, `Generating a 2D ${this.layout} layout...`);

        // Use this.dataSet to build the elements for the cytoscape graph.
        // Include default values that are input to style fuctions.

        var width = this.jDiv.width();
        var height = this.jDiv.height();

        this.nodes.splice(0, this.nodes.length);
        this.links.splice(0, this.links.length);

        var children = this.graph3d.nodeMeshes;
        this.colorMode = this.graph3d.colorMode;
        this.directionMode = this.graph3d.edgeDirectionMode;

        for (var i = 0; i < children.length; i++) {
            var node = children[i];
            var d = node.userData;

            var nodeObject = new Object();
            nodeObject["id"] = d.id;
            nodeObject["color"] = "#".concat(node.material.color.getHexString());
            nodeObject["radius"] = node.scale.x;
            nodeObject["colors"] = d.colors;

            // Use projection of colaGraph to screen space to initialise positions
            var position = (new THREE.Vector3()).setFromMatrixPosition(node.matrixWorld);
            position.project(this.camera);
            nodeObject["x"] = position.x;
            nodeObject["y"] = position.y;

            /*
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
            */

            this.nodes.push(nodeObject);
        }

        // Add Edges to graph
        for (var i = 0; i < this.graph3d.edgeList.length; i++) {
            var edge = this.graph3d.edgeList[i];
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


        // Old Init above, old update below     ///jm


        // Use saveObj and this.layout to create the layout and style options, then create the cytoscape graph
        let container = this.container;
        let colorAttribute = this.saveObj.nodeSettings.nodeColorAttribute;
        
        let nodes = this.nodes.map(d => {
            return {
                data: {
                    id: "n_" + d.id,
                    parent: "c_" + d.color.substring(1),
                    sourceId: d.id,
                    color: d.color || "gray",         //TODO: Can retire this when multiple colors is working across all visualisations
                    colors: d.colors,
                    radius: d.radius * this.scale * this.BASE_RADIUS,
                    border: d.radius * this.scale * this.BASE_BORDER_WIDTH,
                    labelSize: d.radius * this.scale * this.BASE_LABEL_SIZE,
                    label: this.dataSet.brainLabels[d.id] || d.id
                },
                position: {
                    x: d.x,
                    y: d.y
                },
                classes: "child"
            };
        });
        let edges = this.links.map(d => ({
            data: {
                id: "e_" + d.colaGraphEdgeListIndex,
                source: "n_" + d.source.id,
                target: "n_" + d.target.id,
                color: d.source.color,
                highlight: false,
                weight: this.scale * this.BASE_EDGE_WEIGHT
            }
        }));
        // Compound nodes for grouping - TODO: not quite working as expected, not affecting layout
        let compounds = nodes
            .reduce((acc, d) => {
                let i = acc.length;
                while (i--) if (acc[i] === d.data.color) return acc;
                acc.push(d.data.color);
                return acc;
            }, [])
            .map(d => ({
                data: {
                    id: "c_" + d.substring(1),
                    radius: 10,
                    color: d,
                    border: 2
                },
                classes: "cluster"
            })) 
            ;

        let elements = nodes.concat(<any>edges).concat(<any>compounds);
        //let elements = nodes.concat(<any>edges);
        
        var nodeStyle = {
            "width": "data(radius)",
            "height": "data(radius)",
            "background-color": "data(color)",
            "background-opacity": 1,
            "border-width": "data(border)",
            "border-color": "black",
            "border-opacity": 0,
            "font-size": "data(labelSize)",
            "font-weight": "bold",
            "text-outline-color": "white",
            "text-outline-opacity": 0.5,
            "text-outline-width": "data(border)"
        };
        if (this.dataSet.attributes.info[colorAttribute]) {
            nodeStyle["pie-size"] = "100%";
            nodeStyle["background-opacity"] = 0;
            let nSlices = this.dataSet.attributes.info[colorAttribute].numElements;
            for (let i = 0; i < nSlices; i++) {
                nodeStyle[`pie-${i + 1}-background-color`] = e => "#" + e.data("colors")[i].color.toString(16);
                nodeStyle[`pie-${i + 1}-background-size`] = e => e.data("colors")[i].portion * 100;
            }
        }
        var edgeStyle = {
            "width": "data(weight)",
            "opacity": 0.5,
            'line-color': 'data(color)',
            'mid-target-arrow-color': 'data(color)',
        };

        let boundingBox = {
            x1: 0,
            y1: 0,
            w: container.offsetWidth * 0.3,
            h: container.offsetHeight * 0.5
        };

        // Default layout is simple and fast
        let layoutOptions = <any>{
            name: this.layout,
            animate: false,
            boundingBox
        }
        switch (this.layout) {
            case "cose":
                //layoutOptions.idealEdgeLength = this.edgeBaseLength * this.edgeLengthScale;
                layoutOptions.idealEdgeLength = 100;
                //nodeStyle["pie-size"] = "50%";
                //nodeStyle["border-width"] = "data(radius)";
                break;
            case "cose-bilkent":
                //layoutOptions.idealEdgeLength = this.edgeBaseLength * this.edgeLengthScale;
                layoutOptions.numIter = 15;
                break;
            case "cola":
                layoutOptions = <any>{
                    name: "cola",

                    animate: false,
                    fit: false,
                    //animate: true,
                    //fit: true,

                    // Options that may affect speed of layout
                    ungrabifyWhileSimulating: true,
                    maxSimulationTime: 4000,        // Only starts counting after the layout startup, which can take some time by itself. 0 actually works well.
                    
                    //boundingBox,      //TODO: seems to be doing nothing, would be nice
                    //padding: 50,

                    //edgeLength: this.edgeBaseLength * this.edgeLengthScale * 0.001,      // Not much effect for any lengths?
                    //edgeSymDiffLength: this.edgeBaseLength * this.edgeLengthScale * 0.01,
                    //edgeJaccardLength: this.edgeBaseLength * this.edgeLengthScale * 0.01,
                    handleDisconnected: true,
                    avoidOverlap: true,

                    unconstrIter: 15,
                    userConstIter: 10,
                    allConstIter: 15,

                    flow: false
                };
                break;
            case "cola-flow":
                // Mostly the same as cola
                layoutOptions = <any>{
                    name: "cola",
                    animate: false,
                    ungrabifyWhileSimulating: true,
                    maxSimulationTime: 1000,
                    //edgeLength: this.edgeBaseLength * this.edgeLengthScale,
                    handleDisconnected: true,
                    avoidOverlap: true,
                    unconstrIter: 15,
                    userConstIter: 0,
                    allConstIter: 15,

                    flow: true
                };
                break;
        }
        

        this.cy = cytoscape({
            container,
            elements,
            style: [ // the stylesheet for the graph
                {
                    selector: "node.child",
                    style: nodeStyle 
                },
                {
                    selector: "node.cluster",
                    style: {
                        "background-opacity": 0.0,
                        "border-width": 0
                    }
                },
                {
                    selector: "node.cluster.highlight",
                    style: {
                        "background-opacity": 0.5,
                        "border-width": 1
                    }
                },
                {
                    selector: "edge",
                    style: edgeStyle
                },
                {
                    selector: "edge.highlight",
                    style: {
                        //width: 3,
                        "mid-target-arrow-shape": "triangle",
                        opacity: 1
                    }
                },
                {
                    selector: "node.highlight",
                    style: {
                        'label': 'data(label)',     //TODO: use configured attribute
                        "border-opacity": 0.5
                    }
                },
                {
                    selector: "node.select",
                    style: {
                        'label': 'data(label)',     //TODO: use configured attribute
                        "border-opacity": 1.0
                    }
                }
            ],
            minZoom: 0.1,
            maxZoom: 10,
            wheelSensitivity: 0.2,
            layout: layoutOptions
        });

        let commonData = this.commonData;
        let cy = this.cy;
        cy.on("mouseover", "node.cluster", function (e) {
            this.addClass("highlight");
        });
        cy.on("mouseout", "node.cluster", function (e) {
            this.removeClass("highlight");
        });
        cy.on("mouseover", "node.child", function (e) {
            commonData.nodeIDUnderPointer[4] = this.data("sourceId");
        });
        cy.on("mouseout", "node.child", function (e) {
            commonData.nodeIDUnderPointer[4] = -1;
        });
        cy.on("tap", "node.child", function (e) {
            let oldSelected = commonData.selectedNode;
            if (oldSelected > -1) {
                cy.elements("node").removeClass("select");
            }
            let newSelected = this.data("sourceId");
            this.addClass("select");
        });
        cy.on("layoutstop", function (e) {
            // Some layouts need to pan/zoom after layout is done
            cy.fit();
            cy.pan({
                x: container.offsetWidth * 0.5,
                y: container.offsetHeight * 0.2
            });
            cy.zoom(cy.zoom() * 0.6);
        });
        cy.fit();
        cy.pan({
            x: container.offsetWidth * 0.5,
            y: container.offsetHeight * 0.2
        });
        cy.zoom(cy.zoom() * 0.6);

        CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS, `New 2D ${this.layout} layout created`);
    }

    updateInteractive() {
        // Minor update, no layout recalculation but will have redraw, e.g. for selected node change
        this.cy.batch(() => {
            this.cy.elements(".highlight").removeClass("highlight");
            this.cy.elements("node.select").removeClass("select");
            this.cy.elements(`node[sourceId=${this.commonData.nodeIDUnderPointer[0]}]`)
                .addClass("highlight")
                .neighborhood()
                .addClass("highlight")
                ;
            this.cy.elements(`node[sourceId=${this.commonData.nodeIDUnderPointer[4]}]`)
                .addClass("highlight")
                .neighborhood()
                .addClass("highlight")
                ;

            this.cy.elements(`node[sourceId=${this.commonData.selectedNode}]`).addClass("select");
        });
    }
    
    setUserControl(isOn: boolean) {
        if (this.cy) {
            this.cy.userPanningEnabled(isOn);
            this.cy.userZoomingEnabled(isOn);
            this.cy.boxSelectionEnabled(isOn);
        }
    }


    /*
        Menu
    */

    settingOnChange() {
        this.cy.batch(() => {
            this.cy.elements("node.child")
                .data("radius", this.scale * this.BASE_RADIUS)
                .data("border", this.scale * this.BASE_BORDER_WIDTH)
                .data("labelSize", this.scale * this.BASE_LABEL_SIZE)
                ;
            this.cy.elements("edge")
                .data("weight", this.scale * this.BASE_EDGE_WEIGHT)
                ;
        });
    }

    menuButtonOnClick() {
        var l = $('#button-graph2dalt-option-menu-' + this.id).position().left + 5;
        var t = $('#button-graph2dalt-option-menu-' + this.id).position().top - $('#div-graph2dalt-layout-menu-' + this.id).height() - 15;
        
        $('#div-graph2dalt-layout-menu-' + this.id).zIndex(1000);
        $('#div-graph2dalt-layout-menu-' + this.id).css({ left: l, top: t, height: 'auto' });
        $('#div-graph2dalt-layout-menu-' + this.id).fadeToggle('fast');
    }

    setupOptionMenuUI() {
        // Remove existing html elements
        this.graph2DAltDotClass = ".graph-2dalt-menu-" + this.id;
        this.graph2DAltClass = "graph-2dalt-menu-" + this.id;
        $("label").remove(this.graph2DAltDotClass);
        $("select").remove(this.graph2DAltDotClass);
        $("button").remove(this.graph2DAltDotClass);
        $("div").remove(this.graph2DAltDotClass);

        // Function variables response to changes in settings
        var varEdgeLengthOnChange = () => {
            this.scale = $("#div-scale-slider-alt-" + this.id)['bootstrapSlider']().data('bootstrapSlider').getValue();
            this.settingOnChange();
        };

        var varGroupNodesOnChange = (groupBy) => {
            this.groupNodesBy = groupBy;
            this.settingOnChange();
        }

        var varMenuButtonOnClick = () => { this.menuButtonOnClick(); };

        var changeLayout = layout => {
            this.layout = layout;
            this.updateGraph();
        }

        // Setting Options
        // option button
        this.jDiv.append($('<button id="button-graph2dalt-option-menu-' + this.id + '" class="' + this.graph2DAltClass + ' btn  btn-sm btn-primary" ' +
            'data-toggle="tooltip" data-placement="top" title="Show side-by-side graph representation">Options</button>')
            .css({ 'position': 'relative', 'margin-left': '5px', 'font-size': '12px', 'z-index': 1000 })
            .click(function () { varMenuButtonOnClick(); }));


        //------------------------------------------------------------------------
        // menu
        this.jDiv.append($('<div id="div-graph2dalt-layout-menu-' + this.id + '" class="' + this.graph2DAltClass + '"></div>')
            .css({
                'display': 'none',
                'background-color': '#feeebd',
                'position': 'absolute',
                'padding': '8px',
                'border-radius': '5px'
            }));

        //------------------------------------------------------------------------
        // menu - scale
        $('#div-graph2dalt-layout-menu-' + this.id).append('<div>Scale elements<div/>');
        $('#div-graph2dalt-layout-menu-' + this.id).append($('<input id="div-scale-slider-alt-' + this.id + '" class=' + this.graph2DAltClass + 'data-slider-id="surface-opacity-slider" type="text"' +
            'data-slider-min="1" data-slider-max="10" data-slider-step="0.5" data-slider-value="5" />')
            .css({ 'position': 'relative', 'width': '150px' }));

        $("#div-scale-slider-alt-" + this.id)['bootstrapSlider']();
        $("#div-scale-slider-alt-" + this.id)['bootstrapSlider']().on('change', varEdgeLengthOnChange);
        

        // menu - group nodes
        $('#div-graph2dalt-layout-menu-' + this.id).append('<div id="div-graph2dalt-group-' + this.id + '">bundle: </div>');
        $('#div-graph2dalt-group-' + this.id).append($('<select id="select-graph2dalt-group-' + this.id + '" class=' + this.graph2DAltClass + '></select>')
            .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () { varGroupNodesOnChange($(this).val()); }));

        $('#select-graph2dalt-group-' + this.id).empty();

        var option = document.createElement('option');
        option.text = 'none';
        option.value = 'none';
        $('#select-graph2dalt-group-' + this.id).append(option);

        // Add descrete attribute to list
        for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
            var columnName = this.dataSet.attributes.columnNames[i];
            if (this.dataSet.attributes.info[columnName].isDiscrete) {
                $('#select-graph2dalt-group-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');
            }

        }
        
        // menu - layouts
        $('#div-graph2dalt-layout-menu-' + this.id).append('<div id="div-graph2dalt-layout-' + this.id + '">layout: </div>');
        $('#div-graph2dalt-layout-' + this.id).append($('<select id="select-graph2dalt-layout-' + this.id + '" class=' + this.graph2DAltClass + '></select>')
            .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () { changeLayout($(this).val()); }));

        $('#select-graph2dalt-layout-' + this.id).empty();

        // Full layout options: ["cose", "cose-bilkent", "cola", "cola-flow", "grid", "circle", "concentric", "breadthfirst", "random"]
        for (let layout of ["cola", "cose", "cose-bilkent", "grid", "concentric"]) {
            var option = document.createElement('option');
            option.text = layout;
            option.value = layout;
            $('#select-graph2dalt-layout-' + this.id).append(option);
        }
        (<any>document.getElementById("select-graph2dalt-layout-" + this.id)).value = this.layout;

        let targetClass = this.graph2DAltClass;
        if (!this.mouseDownEventListenerAdded) {
            this.mouseDownEventListenerAdded = true;
            document.addEventListener('mouseup', (event) => {
                if ((!$(event.target).hasClass(targetClass))) {
                    $('#div-graph2dalt-layout-menu-' + this.id).hide();
                }
            }, false);
        }
                
    }

}
