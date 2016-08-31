

declare var cytoscape;

class Graph2D {
    // UI
    graph2DDotClass: string;
    graph2DClass: string;

    // Options menu
    scale: number = 5;

    groupNodesBy = "none";
    colorMode: string;
    directionMode: string;      // arrow, animation, opacity, gradient, none
    mouseDownEventListenerAdded;
    layout = "cola";

    // Data
    config;

    nodes: any[];
    links: any[];

    // Style constants
    BASE_RADIUS = 7;
    BASE_EDGE_WEIGHT = 2;
    BASE_BORDER_WIDTH = 2;
    BASE_LABEL_SIZE = 8;

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
        // Use this.dataSet to build the elements for the cytoscape graph.
        // Include default values that are input to style fuctions.
        
        this.nodes = [];
        this.links = [];

        let children = this.graph3d.nodeMeshes;
        this.colorMode = this.graph3d.colorMode;
        this.directionMode = this.graph3d.edgeDirectionMode;        

        // Figure out the grouping calculation to use for the chosen grouping attribute
        let getGroup;
        if (this.groupNodesBy !== "none") {
            let colname = this.groupNodesBy;

            //  Get domain of the attributes (assume all positive numbers in the array)
            var columnIndex = this.dataSet.attributes.columnNames.indexOf(colname);

            if (this.dataSet.attributes.info[colname].isDiscrete) {
                // If the attribute is discrete then grouping is clear for simple values, but for multivalue attributes we get the position of the largest value
                getGroup = value => {
                    if (value.length > 1) {
                        return value.indexOf(Math.max(...value));
                    }
                    else {
                        return value[0];
                    }
                };

            } else {
                // If the attribute is continuous, split into 10 bands - TODO: could use user specified ranges
                let min = this.dataSet.attributes.getMin(columnIndex);
                let max = this.dataSet.attributes.getMax(columnIndex);
                let bundleGroupMap = d3.scale.linear().domain([min, max]).range([0, 9.99]); // use 9.99 instead of 10 to avoid a group of a single element (that has the max attribute value)
                getGroup = value => {
                    let bundleGroup = bundleGroupMap(Math.max.apply(Math, value));
                    return Math.floor(bundleGroup);
                };
            }
        }


        for (let i = 0; i < children.length; i++) {
            let node = children[i];
            let d = node.userData;

            if (d.filtered) continue;

            let nodeObject = new Object();
            nodeObject["id"] = d.id;
            nodeObject["color"] = "#".concat(node.material.color.getHexString());
            nodeObject["radius"] = node.scale.x;
            nodeObject["colors"] = d.colors;
            nodeObject["highlighted"] = d.highlighted;

            // Use projection of colaGraph to screen space to initialise positions
            let position = (new THREE.Vector3()).setFromMatrixPosition(node.matrixWorld);
            position.project(this.camera);
            nodeObject["x"] = $.isNumeric(position.x) ? position.x : 0;
            nodeObject["y"] = $.isNumeric(position.y) ? position.y : 0;
            
            // Grouping
            if (this.groupNodesBy !== "none") {
                let value = this.dataSet.attributes.get(this.groupNodesBy)[d.id];
                nodeObject['bundle'] = getGroup(value);
            }

            this.nodes.push(nodeObject);
        }

        // Add Edges to graph
        for (var i = 0; i < this.graph3d.edgeList.length; i++) {
            var edge = this.graph3d.edgeList[i];
            // To ensure consistency between graphs, edge colour info can be taken from the 3D object uniforms.
            // Uniform types are uniforms.(start/end)color: {type: "v4", value: THREE.Vector4 } and uniforms.(start/end)color: {type: "f", value: number}.
            if (edge.visible) {
                var linkObject = new Object();
                linkObject["edgeListIndex"] = i;
                if ((this.graph3d.colorMode === "weight") || (this.graph3d.colorMode === "none")) {
                    linkObject["color"] = edge.color;
                }
                else {
                    // "node"
                    //TODO: use gradient to colour edges - this needs a change to cytoscape.js
                    let colorVector = (new THREE.Vector4()).lerpVectors(edge.uniforms.startColor.value, edge.uniforms.endColor.value, 0.5);
                    linkObject["color"] = `rgb(${colorVector.x * 255}, ${colorVector.y * 255}, ${colorVector.z * 255})`;
                }

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
        

        // Use saveObj and this.layout to create the layout and style options, then create the cytoscape graph
        let container = this.container;
        let colorAttribute = this.saveObj.nodeSettings.nodeColorAttribute;
        
        let nodes = this.nodes.map(d => {
            return {
                data: {
                    id: "n_" + d.id,
                    parent: "c_" + (d.bundle || ""),
                    bundle: d.bundle,
                    sourceId: d.id,
                    color: d.color || "#cfcfcf",
                    color0: d.colors[0] ? "#" + d.colors[0].color.toString(16) : "#bbbbbb",
                    color1: d.colors[1] ? "#" + d.colors[1].color.toString(16) : "#bbbbbb",
                    color2: d.colors[2] ? "#" + d.colors[2].color.toString(16) : "#bbbbbb",
                    color3: d.colors[3] ? "#" + d.colors[3].color.toString(16) : "#bbbbbb",
                    color4: d.colors[4] ? "#" + d.colors[4].color.toString(16) : "#bbbbbb",
                    color5: d.colors[5] ? "#" + d.colors[5].color.toString(16) : "#bbbbbb",
                    color6: d.colors[6] ? "#" + d.colors[6].color.toString(16) : "#bbbbbb",
                    color7: d.colors[7] ? "#" + d.colors[7].color.toString(16) : "#bbbbbb",
                    portion0: d.colors[0] ? d.colors[0].portion * 100 : 0,
                    portion1: d.colors[1] ? d.colors[1].portion * 100 : 0,
                    portion2: d.colors[2] ? d.colors[2].portion * 100 : 0,
                    portion3: d.colors[3] ? d.colors[3].portion * 100 : 0,
                    portion4: d.colors[4] ? d.colors[4].portion * 100 : 0,
                    portion5: d.colors[5] ? d.colors[5].portion * 100 : 0,
                    portion6: d.colors[6] ? d.colors[6].portion * 100 : 0,
                    portion7: d.colors[7] ? d.colors[7].portion * 100 : 0,
                    nodeRadius: d.radius,
                    radius: d.radius * this.scale * this.BASE_RADIUS,
                    border: d.radius * this.scale * this.BASE_BORDER_WIDTH,
                    labelSize: d.radius * this.scale * this.BASE_LABEL_SIZE,
                    label: this.dataSet.brainLabels[d.id] || d.id,
                    highlighted: d.highlighted
                },
                position: {
                    x: d.x,
                    y: d.y
                },
                classes: "child" + (d.highlighted ? " highlighted" : "")
            };
        });
        let edges = this.links.map(d => ({
            data: {
                id: "e_" + d.edgeListIndex,
                source: "n_" + d.source.id,
                target: "n_" + d.target.id,
                color: d.color,
                hover: false,
                edgeWeight: d.width,
                edgeListIndex: d.edgeListIndex,
                weight: d.width * this.scale * this.BASE_EDGE_WEIGHT
            }
        }));
        // Compound nodes for grouping - only for use with layouts that support it well
        let compounds = [];
        if (this.groupNodesBy !== "none") {
            compounds = nodes
                .reduce((acc, d) => {
                    let i = acc.length;
                    while (i--) if (acc[i] === d.data.parent) return acc;
                    acc.push(d.data.parent);
                    return acc;
                }, [])
                .map(d => ({
                    data: {
                        id: d,
                        radius: 10,
                        border: 2
                    },
                    classes: "cluster",
                    selectable: false
                }))
                ;
        }
        

        let elements = nodes.concat(<any>edges).concat(<any>compounds);

        // Default layout is simple and fast
        let layoutOptions = <any>{
            name: this.layout,
            animate: false,
            boundingBox: {
                x1: 0,
                y1: 0,
                w: container.offsetWidth * 0.3,
                h: container.offsetHeight * 0.5
            }
        }
        switch (this.layout) {
            case "cose":
                // This layout gets something very wrong with the boundingBox, possibly ignoring node radii, so we need to compensate
                layoutOptions.fit = true;
                layoutOptions.boundingBox.w *= this.BASE_RADIUS;
                layoutOptions.boundingBox.h *= this.BASE_RADIUS;
                layoutOptions.numIter = 100;
                layoutOptions.nestingFactor = 2;
                layoutOptions.gravity = 200;
                layoutOptions.nodeOverlap = this.BASE_RADIUS * 4;
                layoutOptions.idealEdgeLength = edge => (edge.source().data("radius") + edge.target().data("radius")) * 2;
                break;
            case "cose-bilkent":
                layoutOptions.fit = true;
                layoutOptions.numIter = 15;
                layoutOptions.idealEdgeLength = this.BASE_RADIUS * 4;
                break;
            case "cola":
                layoutOptions.fit = true;

                // Options that may affect speed of layout
                layoutOptions.ungrabifyWhileSimulating = true;
                layoutOptions.maxSimulationTime = 4000;        // Only starts counting after the layout startup, which can take some time by itself. 0 actually works well.
                layoutOptions.handleDisconnected = true;
                layoutOptions.avoidOverlap = true;
                layoutOptions.nodeSpacing = node => node.data("radius") * 0.5;
                
                layoutOptions.unconstrIter = 15;
                layoutOptions.userConstIter = 0;
                layoutOptions.allConstIter = 5;

                layoutOptions.flow = false;

                break;
            case "grid":
                // Looks pretty messy with no sorting at all, so use colours if bundling is not set
                layoutOptions.sort = (a, b) => {
                    let valueA = a.data("bundle") || parseInt(a.data("color").substring(1), 16);
                    let valueB = b.data("bundle") || parseInt(b.data("color").substring(1), 16);
                    return valueA - valueB;
                };
                break;
            case "concentric":
                // Groups into arbitrary rings with no grouping defined, so use colours if bundling is not set.
                // May be too many distinct colour values, so pool into 10 groups.
                if (this.groupNodesBy === "none") {
                    let minColor = 0xffffff;
                    let maxColor = 0x000000;
                    for (let node of children) {
                        let color = node.material.color.getHex();
                        minColor = Math.min(minColor, color);
                        maxColor = Math.max(maxColor, color);
                    }
                    let f = d3.scale.linear().domain([minColor, maxColor]).range([0, 9.99]);
                    layoutOptions.concentric = node => Math.floor(f(parseInt(node.data("color").substring(1), 16)));
                }
                else {
                    layoutOptions.concentric = node => node.data("bundle");
                }
                layoutOptions.fit = true;
                layoutOptions.padding = 500;
                break;
        }
        

        this.cy = cytoscape({
            container,
            elements,
            style: [
                {
                    selector: "node.child",
                    style: {
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
                        "text-outline-width": "data(border)",
                        "pie-size": "100%",
                        "pie-1-background-color": "data(color0)",
                        "pie-2-background-color": "data(color1)",
                        "pie-3-background-color": "data(color2)",
                        "pie-4-background-color": "data(color3)",
                        "pie-5-background-color": "data(color4)",
                        "pie-6-background-color": "data(color5)",
                        "pie-7-background-color": "data(color6)",
                        "pie-8-background-color": "data(color7)",
                        "pie-1-background-size": "data(portion0)",
                        "pie-2-background-size": "data(portion1)",
                        "pie-3-background-size": "data(portion2)",
                        "pie-4-background-size": "data(portion3)",
                        "pie-5-background-size": "data(portion4)",
                        "pie-6-background-size": "data(portion5)",
                        "pie-7-background-size": "data(portion6)",
                        "pie-8-background-size": "data(portion7)"
                    } 
                },
                {
                    selector: "node.cluster",
                    style: {
                        "background-opacity": 0.0,
                        "border-width": 0
                    }
                },
                {
                    selector: "node.child.highlighted",
                    style: {
                        "border-color": "#ffff00",
                        "border-opacity": 1.0
                    }
                },
                {
                    selector: "node.child.hover",
                    style: {
                        'label': 'data(label)',
                        "border-opacity": 0.3
                    }
                },
                {
                    selector: "node.child.hover-neighbour",
                    style: {
                        "border-opacity": 0.3
                    }
                },
                {
                    selector: "node:selected",
                    style: {
                        "border-opacity": 0.3,
                        //"border-style": "double",
                        //"border-width": e => e.data("border") * 2
                    }
                },
                {
                    selector: "node.chosen",
                    style: {
                        'label': 'data(label)',
                        "border-opacity": 1.0
                    }
                },
                {
                    selector: "node.cluster.hover",
                    style: {
                        "background-opacity": 0.3,
                        "border-width": 2
                    }
                },
                {
                    selector: "edge",
                    style: {
                        "width": "data(weight)",
                        "opacity": 0.6,
                        'line-color': 'data(color)',
                        'mid-target-arrow-color': 'data(color)',
                        "mid-target-arrow-shape": (this.directionMode === "arrow") ? "triangle" : "none"
                    }
                },
                {
                    selector: "edge.hover",
                    style: {
                        opacity: 1
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
        cy.on("mousemove", "node.cluster", function (e) {
            this.addClass("hover");
        });
        cy.on("mouseout", "node.cluster", function (e) {
            this.removeClass("hover");
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
                cy.elements("node").removeClass("chosen");
            }
            let newSelected = this.data("sourceId");
            this.addClass("chosen");
        });
        cy.on("layoutstop", e => {
            // Some layouts need to pan/zoom after layout is done
            cy.fit();
            cy.pan({
                x: container.offsetWidth * 0.5,
                y: container.offsetHeight * 0.2
            });
            cy.zoom(cy.zoom() * 0.6);
        });
        cy.fit();
        if (this.layout === "concentric") {
            // This layout tends to centre near the upper-left corner
            cy.pan({
                x: container.offsetWidth * 0.6,
                y: container.offsetHeight * 0.3
            });
        }
        else {
            cy.pan({
                x: container.offsetWidth * 0.5,
                y: container.offsetHeight * 0.2
            });
        }
        cy.zoom(cy.zoom() * 0.7);

    }

    updateInteractive() {
        // Minor update, no layout recalculation but will have redraw, e.g. for selected node change
        if (!this.cy) return;

        this.cy.batch(() => {
            // Hover and selection
            this.cy.elements(".hover").removeClass("hover");
            this.cy.elements(".hover-neighbour").removeClass("hover-neighbour");
            this.cy.elements("node.chosen").removeClass("chosen");
            this.cy.elements(`node[sourceId=${this.commonData.nodeIDUnderPointer[0]}]`)
                .addClass("hover")
                .neighborhood()
                .addClass("hover-neighbour")
                ;
            this.cy.elements(`node[sourceId=${this.commonData.nodeIDUnderPointer[4]}]`)
                .addClass("hover")
                .neighborhood()
                .addClass("hover-neighbour")
                ;

            this.cy.elements(`node[sourceId=${this.commonData.selectedNode}]`).addClass("chosen");

            // Edge colour setting changes
            if ((this.graph3d.colorMode === "weight") || (this.graph3d.colorMode === "none")) {
                this.cy.elements("edge").each((i, e) => {
                    let edge = this.graph3d.edgeList[e.data("edgeListIndex")];
                    e.data("color", edge.color);
                });
            }
            else {
                // "node"
                this.cy.elements("edge").each((i, e) => {
                    let colorVectorSource = this.graph3d.edgeList[e.data("edgeListIndex")].uniforms.startColor.value;
                    let colorVectorTarget = this.graph3d.edgeList[e.data("edgeListIndex")].uniforms.endColor.value;
                    let colorVector = (new THREE.Vector4()).lerpVectors(colorVectorSource, colorVectorTarget, 0.5);
                    e.data("color", `rgb(${colorVector.x * 255}, ${colorVector.y * 255}, ${colorVector.z * 255})`);
                });
            }

            // Node size/colour changes - TODO: colour
            let nodes = this.graph3d.nodeMeshes;
            this.cy.elements("node.child").each((i, e) => {
                // Size
                let node = nodes[e.data("sourceId")];
                let radius = node.scale.x * this.scale * this.BASE_RADIUS
                e.data("radius", radius);

                // Colour
                let d = node.userData;
                e.data("color0", d.colors[0] ? "#" + d.colors[0].color.toString(16) : "black");
                e.data("color1", d.colors[1] ? "#" + d.colors[1].color.toString(16) : "black");
                e.data("color2", d.colors[2] ? "#" + d.colors[2].color.toString(16) : "black");
                e.data("color3", d.colors[3] ? "#" + d.colors[3].color.toString(16) : "black");
                e.data("color4", d.colors[4] ? "#" + d.colors[4].color.toString(16) : "black");
                e.data("color5", d.colors[5] ? "#" + d.colors[5].color.toString(16) : "black");
                e.data("color6", d.colors[6] ? "#" + d.colors[6].color.toString(16) : "black");
                e.data("color7", d.colors[7] ? "#" + d.colors[7].color.toString(16) : "black");
                e.data("portion0", d.colors[0] ? d.colors[0].portion * 100 : 0);
                e.data("portion1", d.colors[1] ? d.colors[1].portion * 100 : 0);
                e.data("portion2", d.colors[2] ? d.colors[2].portion * 100 : 0);
                e.data("portion3", d.colors[3] ? d.colors[3].portion * 100 : 0);
                e.data("portion4", d.colors[4] ? d.colors[4].portion * 100 : 0);
                e.data("portion5", d.colors[5] ? d.colors[5].portion * 100 : 0);
                e.data("portion6", d.colors[6] ? d.colors[6].portion * 100 : 0);
                e.data("portion7", d.colors[7] ? d.colors[7].portion * 100 : 0);

                // Filter highlighting
                if (d.highlighted) {
                    e.addClass("highlighted");
                }
                else {
                    e.removeClass("highlighted");
                }
            });
        });
    }
    
    setUserControl(isOn: boolean) {
        if (this.cy) {
            this.cy.userPanningEnabled(isOn);
            this.cy.userZoomingEnabled(isOn);
            this.cy.boxSelectionEnabled(isOn);
        }
    }

    setDirectionMode(directionMode: string) {
        this.directionMode = directionMode;
        if (this.cy) this.cy.style().selector("edge").style("mid-target-arrow-shape", (this.directionMode === "arrow") ? "triangle" : "none");
    }


    /*
        Menu
    */

    settingOnChange() {
        // Styling changes not affecting layout, triggered by 2d settings
        this.cy.batch(() => {
            this.cy.elements("node.child")
                .data("border", this.scale * this.BASE_BORDER_WIDTH)
                .data("labelSize", this.scale * this.BASE_LABEL_SIZE)
                .each((i, e) => e.data("radius", e.data("nodeRadius") * this.scale * this.BASE_RADIUS))
                ;
            this.cy.elements("edge")
                .each((i, e) => e.data("weight", e.data("edgeWeight") * this.scale * this.BASE_EDGE_WEIGHT))
                ;
        });
    }

    menuButtonOnClick() {
        let l = $('#button-graph2d-option-menu-' + this.id).position().left + 5;
        let b = $('#button-graph2d-option-menu-' + this.id).outerHeight();
        
        $('#div-graph2d-layout-menu-' + this.id).zIndex(1000);
        $('#div-graph2d-layout-menu-' + this.id).css({ left: l, bottom: b, height: 'auto' });
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

        // Function variables response to changes in settings
        var varEdgeLengthOnChange = () => {
            this.scale = $("#div-scale-slider-alt-" + this.id)['bootstrapSlider']().data('bootstrapSlider').getValue();
            this.settingOnChange();
        };

        var varGroupNodesOnChange = groupBy => {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.INFO, `Updating grouping for ${this.layout} layout...`);
            this.groupNodesBy = groupBy;
            this.updateGraph();
        }

        var varMenuButtonOnClick = () => { this.menuButtonOnClick(); };

        var changeLayout = layout => {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.INFO, `Updating ${this.layout} layout...`);
            this.layout = layout;
            this.updateGraph();
        }

        // Setting Options
        // option button
        this.jDiv.append($('<button id="button-graph2d-option-menu-' + this.id + '" class="' + this.graph2DClass + ' btn  btn-sm btn-primary" ' +
            'data-toggle="tooltip" data-placement="top" title="Show side-by-side graph representation">Options</button>')
            .css({ 'position': 'relative', 'margin-left': '5px', 'font-size': '12px', 'z-index': 500 })
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
        // menu - layouts
        $('#div-graph2d-layout-menu-' + this.id).append('<div id="div-graph2d-layout-' + this.id + '">layout: </div>');
        $('#div-graph2d-layout-' + this.id).append($('<select id="select-graph2d-layout-' + this.id + '" class=' + this.graph2DClass + '></select>')
            .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () { changeLayout($(this).val()); }));

        $('#select-graph2d-layout-' + this.id).empty();

        // Full possible layout options: ["cose", "cose-bilkent", "cola", "cola-flow", "grid", "circle", "concentric", "breadthfirst", "random"]
        for (let layout of ["cola", "cose", "cose-bilkent", "grid", "concentric"]) {
            var option = document.createElement('option');
            option.text = layout;
            option.value = layout;
            $('#select-graph2d-layout-' + this.id).append(option);
        }
        (<any>document.getElementById("select-graph2d-layout-" + this.id)).value = this.layout;
        $('#select-graph2d-layout-' + this.id).val(this.layout);


        // menu - group nodes
        $('#div-graph2d-layout-menu-' + this.id).append('<div id="div-graph2d-group-' + this.id + '">bundle: </div>');
        $('#div-graph2d-group-' + this.id).append(
            $('<select id="select-graph2d-group-' + this.id + '" class=' + this.graph2DClass + '></select>')
                .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
                .on("change", function () { varGroupNodesOnChange($(this).val()); })
        );

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
        $('#select-graph2d-group-' + this.id).val(this.groupNodesBy);


        // menu - scale
        $('#div-graph2d-layout-menu-' + this.id).append('<div>Scale elements<div/>');
        $('#div-graph2d-layout-menu-' + this.id).append($('<input id="div-scale-slider-alt-' + this.id + '" class=' + this.graph2DClass + 'data-slider-id="surface-opacity-slider" type="text"' +
            'data-slider-min="1" data-slider-max="10" data-slider-step="0.5" data-slider-value="5" />')
            .css({ 'position': 'relative', 'width': '150px' }));

        $("#div-scale-slider-alt-" + this.id)['bootstrapSlider']({ tooltip_position: "bottom" });
        $("#div-scale-slider-alt-" + this.id)['bootstrapSlider']().on('change', varEdgeLengthOnChange);
        
        $("#div-scale-slider-alt-" + this.id)['bootstrapSlider']("setValue", this.scale);


        let targetClass = this.graph2DClass;
        if (!this.mouseDownEventListenerAdded) {
            this.mouseDownEventListenerAdded = true;
            document.addEventListener('mouseup', (event) => {
                if ((!$(event.target).hasClass(targetClass))) {
                    $('#div-graph2d-layout-menu-' + this.id).hide();
                }
            }, false);
        }
                
    }

}
