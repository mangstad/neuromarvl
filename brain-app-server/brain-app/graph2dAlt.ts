

declare var cytoscape;

class Graph2DAlt {
    id: number;
    jDiv;
    dataSet: DataSet;

    container;

    // UI
    graph2DDotClass: string;
    graph2DClass: string;
    isFlowLayoutOn: boolean;

    // Data
    commonData;

    nodes: any[];
    links: any[];

    cy;

    constructor(id: number, jDiv, dataSet: DataSet, container, commonData) {
        this.nodes = [];
        this.links = [];

        this.container = container;
        this.id = id;
        this.jDiv = jDiv;
        this.dataSet = dataSet;
        
        this.commonData = commonData;

    }


    initGraph(colaGraph: Graph3D) {
        //this.colorMode = colaGraph.colorMode;
        //this.directionMode = colaGraph.edgeDirectionMode;
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

        this.updateGraph(this.container);
    }



    updateGraph(container) {
        console.log(this.nodes);///
        console.log(this.links);///

        var width = container.offsetWidth;
        var height = container.offsetHeight;

        var nodes = this.nodes.map(d => ({
            data: {
                id: "n_" + d.id,
                color: d.color
            },
            position: {
                x: d.x,
                y: d.y
            }
        }));
        var edges = this.links.map(d => ({
            data: {
                id: "e_" + d.colaGraphEdgeListIndex,
                source: "n_" + d.source.id,
                target: "n_" + d.target.id,
                color: d.source.color
            }
        }));
        var elements = nodes.concat(<any>edges);

        console.log(elements);///

        this.cy = cytoscape({
            container,
            elements,
            style: [ // the stylesheet for the graph
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(color)',
                        'label': 'data(id)'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 3,
                        'line-color': 'data(color)',
                        'target-arrow-color': '#ccc',
                        'target-arrow-shape': 'triangle'
                    }
                }
            ],
            layout: {
                name: 'cola',
                animate: false,
                //boundingBox: {x1: 0, y1: 0, w: width/2, h: height/2}
            }
        });
        console.log("cytoscape test loaded");///
    }



    setupOptionMenuUI() {
        // Remove existing html elements
        this.graph2DDotClass = ".graph-2dalt-menu-" + this.id;
        this.graph2DClass = "graph-2dalt-menu-" + this.id;
        $("label").remove(this.graph2DDotClass);
        $("select").remove(this.graph2DDotClass);
        $("button").remove(this.graph2DDotClass);
        $("div").remove(this.graph2DDotClass);

        // Default Setting
        this.isFlowLayoutOn = false;

        // Function variables response to changes in settings
        /*
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
        */


    }


}
