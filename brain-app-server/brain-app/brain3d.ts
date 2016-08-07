/// <reference path="../extern/ts/descent.ts"/>
/// <reference path="../extern/ts/shortestpaths.ts"/>
/**
    This application uses similarity data between areas of the brain to construct a thresholded graph with edges
    between the most similar areas. It is designed to be embedded in a view defined in brainapp.html / brainapp.ts.
*/

// GLOBAL VARIABLES
declare var d3;
declare var jscolor;
declare var numeric;
declare var packages;
declare function d3adaptor(): string;

var colans = <any>cola;
var sliderSpace = 70; // The number of pixels to reserve at the bottom of the div for the slider
//var uniqueID = 0; // Each instance of this application is given a unique ID so that the DOM elements they create can be identified as belonging to them
var maxEdgesShowable = 1000;
var initialEdgesShown = 20; // The number of edges that are shown when the application starts

// The width and the height of the box in the xy-plane that we must keep inside the camera (by modifying the distance of the camera from the scene)
var widthInCamera = 520;
var heightInCamera = 360;

const RENDER_ORDER_BRAIN = 0.5;

// TODO: Proper reset and destruction of the application (the 'instances' variable will continue to hold a reference - this will cause the application to live indefinitely)
/*
var instances = Array<Brain3DApp>(0); // Stores each instance of an application under its id, for lookup by the slider input element

function sliderChangeForID(id: number, v: number) {
    instances[id].sliderChange(v);
}
*/

class Brain3DApp implements Application, Loopable {
    id: number;
    loop: Loop;
    input: InputTarget;
    jDiv;
    jDivProcessingNotification;
    deleted: boolean = false;

    // THREE variables
    camera;
    scene;
    renderer;
    cursor = new THREE.Vector2();
    descent: cola.Descent; // The handle to the constraint solver

    // Data/objects
    commonData: CommonData;
    dataSet: DataSet;
    saveObj;

    // Brain Surface
    surfaceUniformList = [];
    brainModelOrigin;
    brainSurfaceMode;
    brainSurface;
    brainSurfaceBoundingSphere;
    brainObject; // Brain Object surface used for controling object rotation
    brainContainer; // Container of brain object used for translation and camera facing direction
    surfaceMaterial;

    // 3D graph of brain connectivity
    colaObject; // Base object for the cola graph
    brainGeometry;
    colaCoords: number[][];
    

    //Graphs
    circularGraph: CircularGraph = null;
    colaGraph: Graph3D = null;
    canvasGraph: Graph2D = null;
    physioGraph: Graph3D = null;
    needUpdate = false;
    isAnimationOn = false;

    graph2dContainer;

    svg;
    svgDefs;
    ignore3dControl: boolean;
    svgAllElements;
    svgNodeBundleArray: any[];
    isControllingGraphOnly: boolean = false;
    svgNeedsUpdate: boolean = false;
    d3Zoom = d3.behavior.zoom();

    //nodeColorings: number[]; // Stores the colorings associated with the groups
    dissimilarityMatrix: number[][] = []; // An inversion of the similarity matrix, used for Cola graph distances

    // State
    showingTopologyNetwork: boolean = false;
    transitionInProgress: boolean = false;
    currentThreshold: number = 0;
    filteredAdjMatrix: number[][];
    selectedNodeID = -1;

    edgeCountSliderValue: number = 0;
    surfaceLoaded: boolean = false;

    //CAMERA
    CAMERA_ZOOM_SPEED = 15;
    originalCameraPosition: THREE.Vector3;

    defaultFov: number;
    fovZoomRatio = 1;
    currentViewWidth: number; 

    allLabels: boolean = false;
    autoRotation: boolean = false;
    weightEdges: boolean = false;
    colorMode: string = "none";
    directionMode: string = "none"
    bundlingEdges: boolean = false;

    networkType: string;

    mouse = {
        dx: 0,
        dy: 0
    }

    // Constants
    nearClip = 1;
    farClip = 2000;
    //modeLerpLength: number = 0.6;
    modeLerpLength: number = 0.0;       //TODO: Effectively kills the animation. Remove it properly (or fix if easy to do)
    rotationSpeed: number = 1.2;
    graphOffset: number = 120;
    colaLinkDistance = 15;

    /*
    closeBrainAppCallback;

    regCloseBrainAppCallback(callback: (id: number) => void) {
        this.closeBrainAppCallback = callback;f
    }
    */
    
    constructor(info, commonData: CommonData, inputTargetCreator: (l: number, r: number, t: number, b: number) => InputTarget, saveObj) {

        this.id = info.id;
        this.brainModelOrigin = info.brainModelOrigin;
        this.jDiv = info.jDiv;

        if (info.brainSurfaceMode) {
            this.brainSurfaceMode = info.brainSurfaceMode;
        } else {
            this.brainSurfaceMode = 0;
        }
        this.commonData = commonData;
        this.saveObj = saveObj;
        this.input = inputTargetCreator(0, 0, 0, sliderSpace);
        this.edgeCountSliderValue = initialEdgesShown;
         
        // Setting up viewport
        this.setupInput();
        this.setupUserInteraction(this.jDiv);

        // Set up camera
        this.camera = new THREE.PerspectiveCamera(45, 1, this.nearClip, this.farClip);
        this.resize(this.jDiv.width(), this.jDiv.height());

        // Set up scene
        var ambient = new THREE.AmbientLight(0x1f1f1f);
        var directionalLight = new THREE.DirectionalLight(0xffeedd);
        directionalLight.position.set(0, 0, 1);
        this.scene = new THREE.Scene();
        this.scene.add(directionalLight);
        this.scene.add(ambient);

        // Set up the base objects for the graphs
        this.brainObject = new THREE.Object3D();
        this.brainContainer = new THREE.Object3D();
        this.brainContainer.add(this.brainObject);
        this.brainContainer.position.set(-this.graphOffset, 0, 0);
        this.brainContainer.lookAt(this.camera.position);
        this.scene.add(this.brainContainer);

        this.colaObject = new THREE.Object3D();
        this.colaObject.position.set(-this.graphOffset, 0, 0);
        this.scene.add(this.colaObject);

        // Register the data callbacks
        var coords = () => {
            this.restart();
        };
        var lab = () => {
            this.restart();
                   
        };

        //if (this.commonData.noBranSurface == true) this.surfaceLoaded = true;

        // Load default brain surface mode when the new model is loaded
        this.setBrainMode(this.brainSurfaceMode);

        commonData.regNotifyCoords(coords);
        commonData.regNotifyLabels(lab);

        // Set up loop
        if (!this.loop)
            this.loop = new Loop(this, 0.03);

        // Initialize Graph Objects
        this.circularGraph = new CircularGraph( this.id, this.jDiv, this.dataSet,
                                                this.svg, this.svgDefs, this.svgAllElements,
                                                this.d3Zoom, this.commonData, this.saveObj);
        
    }   

    setEdgeDirection(directionMode) {
        this.directionMode = directionMode;
        if (this.physioGraph) this.physioGraph.setEdgeDirection(directionMode);
        if (this.colaGraph) this.colaGraph.setEdgeDirection(directionMode);

        if (this.circularGraph) this.circularGraph.circularLayoutEdgeDirectionModeOnChange(directionMode);
        
        this.isAnimationOn = (directionMode === "animation");
        
        this.svgNeedsUpdate = true;

        if (this.dataSet.info.isSymmetricalMatrix && directionMode !== "none") {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.WARNING,
                "The given similarity matrix is symmetrical," +
                "so the animation of edges do not reflect their actual direction.");
        }
    }


    getNodeColors(): { color: number, portion: number } [][] {
        /* Get the colour array, a mapping of the configured colour attribute to colour values, e.g.
            [
                // Discrete
                [
	                {color: 0xff0000, portion: 1.0},
	                {color: 0x00ff00, portion: 0.0},
	                {color: 0x0000ff, portion: 0.0}
                ],
                // Continuous
                [
	                {color: 0xfa36dd, portion: 0.33},
	                {color: 0x006f34, portion: 0.33},
	                {color: 0x228d00, portion: 0.33}
                ]
            ]
        */
        let nSettings = this.saveObj.nodeSettings;
        let colorAttribute = nSettings.nodeColorAttribute;
        let defaultColor = { color: 0xd3d3d3, portion: 1.0 };
        let a = this.dataSet.attributes;
        
        if (!a.info[colorAttribute]) {
            return Array.apply(null, Array(a.numRecords)).map(d => [defaultColor]);
        }

        let valueArray = a.get(colorAttribute);
        
        if (a.info[colorAttribute].isDiscrete) {
            let discreteColorValues = nSettings.nodeColorDiscrete.map(colorString => parseInt(colorString.substring(1), 16));
            if (a.info[colorAttribute].numElements > 1) {
                // Discrete multi-value has each colour from the mapping with its proportion of total value in that node
                return valueArray.map(aArray => {
                    let singlePortion = (1 / aArray.reduce((weight, acc) => acc + weight, 0)) || 0;
                    return aArray.map((value, i) => ({
                        color: discreteColorValues[i],
                        portion: value * singlePortion
                    }))
                });
            }
            else {
                // Discrete single value is just an ordinal mapping
                let colorMap = d3.scale
                    .ordinal()
                    .domain(a.info[colorAttribute].distinctValues)
                    .range(discreteColorValues)
                    ;
                return valueArray.map(aArray => aArray.map(value => ({
                    color: colorMap(value),
                    portion: 1.0
                })));
            }
        }
        else {
            // Continuous has each value mapped with equal proportion
            let i = a.columnNames.indexOf(colorAttribute);
            let singlePortion = (1 / a.info[colorAttribute].numElements) || 0;
            let colorMap = d3.scale
                .linear()
                .domain([a.getMin(i), a.getMax(i)])
                .range([nSettings.nodeColorContinuousMin, nSettings.nodeColorContinuousMax])
                ;
            return valueArray.map(aArray => aArray.map(value => ({
                color: colorMap(value),
                portion: singlePortion
            })));
        }
    }

    setupUserInteraction(jDiv) {
        var varShowNetwork = (b: boolean) => { this.showNetwork(b); };
        var varEdgesBundlingOnChange = () => { this.edgesBundlingOnChange(); };
        var varAllLabelsOnChange = () => { this.allLabelsOnChange(); };
        var varAutoRotationOnChange = (s) => { this.autoRotationOnChange(s); };
        var varSliderMouseEvent = (e: string) => { this.sliderMouseEvent(e); };
        var varGraphViewSliderOnChange = (v: number) => { this.graphViewSliderOnChange(v); };
        var varEdgeCountSliderOnChange = (v: number) => { this.edgeCountSliderOnChange(v); };
        var varCloseBrainAppOnClick = () => { this.closeBrainAppOnClick(); };
        var varDefaultOrientationsOnClick = (s: string) => { this.defaultOrientationsOnClick(s); };
        var varNetworkTypeOnChange = (s: string) => { this.networkTypeOnChange(s); };
        var varBrainSurfaceModeOnChange = () => {
            if (this.brainSurfaceMode === 0) {
                this.brainSurfaceMode = 1;
                this.setBrainMode(1);
                if (this.dataSet) {
                    var newCoords = this.computeMedialViewCoords();
                    this.physioGraph.setNodePositions(newCoords);
                    this.physioGraph.update();
                }
            } else {
                this.brainSurfaceMode = 0;
                this.setBrainMode(0);
                if (this.dataSet) {
                    this.physioGraph.setNodePositions(this.dataSet.brainCoords);
                    this.physioGraph.update();
                }
            }
        }

        var varShowProcessingNotification = () => { this.showProcessingNotification(); };

        // Set the background color
        jDiv.css({ backgroundColor: '#ffffff' });

        // Set up renderer, and add the canvas and the slider to the div
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: true
        });
        this.renderer.sortObjects = true;

        this.renderer.setSize(jDiv.width(), (jDiv.height() - sliderSpace));
        jDiv.append($('<span id="close-brain-app-' + this.id + '" title="Close" class="view-panel-span"  data-toggle="tooltip" data-placement="bottom">x</span>')
            .css({ 'right': '6px', 'top': '10px', 'font-size': '12px', 'z-index': 1000 })
            .click(function () { varCloseBrainAppOnClick(); }))

            .append($('<span id="top-view-' + this.id + '" title="Top View" class="view-panel-span" data-toggle="tooltip" data-placement="left">T</span>')
                .css({ 'right': '6px', 'top': '30px', 'z-index': 1000 })
                .click(function () { varDefaultOrientationsOnClick("top"); }))
            .append($('<span id="bottom-view-' + this.id + '" title="Bottom View" class="view-panel-span" data-toggle="tooltip" data-placement="left">B</span>')
                .css({ 'right': '6px', 'top': '50px', 'z-index': 1000 })
                .click(function () { varDefaultOrientationsOnClick("bottom"); }))
            .append($('<span id="left-view-' + this.id + '" title="Left View" class="view-panel-span" data-toggle="tooltip" data-placement="left">L</span>')
                .css({ 'right': '6px', 'top': '70px', 'z-index': 1000 })
                .click(function () { varDefaultOrientationsOnClick("left"); }))
            .append($('<span id="right-view-' + this.id + '" title="Right View" class="view-panel-span" data-toggle="tooltip" data-placement="left">R</span>')
                .css({ 'right': '6px', 'top': '90px', 'z-index': 1000 })
                .click(function () { varDefaultOrientationsOnClick("right"); }))
            .append($('<span id="front-view-' + this.id + '" title="Front View" class="view-panel-span" data-toggle="tooltip" data-placement="left">F</span>')
                .css({ 'right': '6px', 'top': '110px', 'z-index': 1000 })
                .click(function () { varDefaultOrientationsOnClick("front"); }))
            .append($('<span id="back-view-' + this.id + '" title="Back View" class="view-panel-span" data-toggle="tooltip" data-placement="left">B</span>')
                .css({ 'right': '6px', 'top': '130px', 'z-index': 1000 })
                .click(function () { varDefaultOrientationsOnClick("back"); }))
            .append($('<span id="all-labels-' + this.id + '" title="All Labels" class="view-panel-span" data-toggle="tooltip" data-placement="left">&#8704</span>')
                .css({ 'right': '6px', 'top': '150px', 'z-index': 1000 })
                .click(function () { varAllLabelsOnChange(); }))
            .append($('<span id="top-view-' + this.id + '" title="Split Brain" class="view-panel-span" data-toggle="tooltip" data-placement="left">M</span>')
                .css({ 'right': '6px', 'top': '170px', 'z-index': 1000 })
                .click(function () { varBrainSurfaceModeOnChange(); }))
            .append($('<span id="anti-auto-rotation-' + this.id + '" title="Anticlockwise Auto Rotation" class="view-panel-span" data-toggle="tooltip" data-placement="left">&#8634</span>')
                .css({ 'right': '6px', 'top': '190px', 'z-index': 1000 })
                .click(function () { varAutoRotationOnChange("anticlockwise"); }))


            // Circular Graph
            .append($('<div id="div-svg-' + this.id + '"></div>')
                .css({ 'position': 'absolute', 'width': '100%', 'height': '100%', 'top': 0, 'left': 0, 'z-index': 10, 'overflow': 'hidden' }))

            .append(this.renderer.domElement)
            .append('<p>Showing <label id="count-' + this.id + '">0</label> edges (<label id=percentile-' + this.id + '>0</label>th percentile)</p>')

            // Edge count Slider at the bottom of the application
            .append($('<input id="edge-count-slider-' + this.id + '" type="range" min="1" max="' + maxEdgesShowable + '" value="' + initialEdgesShown +
                    'data-toggle="tooltip" data-placement="top" title="Adjust count of visible edges" disabled="true"/>')
                .css({ 'display': 'inline-block', 'width': '300px', 'position': 'relative', 'margin-right': 10, 'z-index': 1000 })
                .mousedown(function () { varSliderMouseEvent("mousedown"); })
                .mouseup(function () { varSliderMouseEvent("mouseup"); })
                .on("input change", function () { varEdgeCountSliderOnChange($(this).val()); })
            )

            // Show Network button
            .append($('<button id="button-show-network-' + this.id + ' data-toggle="tooltip" data-placement="top" title="Show side-by-side graph representation">Show Network</button>')
                .css({ 'margin-left': '10px', 'font-size': '12px', 'position': 'relative', 'z-index': 1000 })
                .click(function () { varShowNetwork(false); })
            )

            // Select Network type dropdown
            .append($('<select id="select-network-type-' + this.id + '"data-toggle="tooltip" data-placement="top" title="Select the graph view type" disabled="true"></select>')
                    .css({ 'margin-left': '5px', 'font-size': '12px', 'width': '80px', 'position': 'relative', 'z-index': 1000 })
                .on("change", function () { varNetworkTypeOnChange($(this).val()); })
            )
            ;

        $("[data-toggle='tooltip']").tooltip(<any>{ container: 'body' });


        //$('#button-show-network-' + this.id).button(); // jQuery button

        // Different type of graphs
        var networkTypeSelect = "#select-network-type-" + this.id;
        var option = document.createElement('option');
        option.text = '3D';
        option.value = '3D';
        $(networkTypeSelect).append(option);
        this.networkType = '3D';

        var option = document.createElement('option');
        option.text = '2D';
        option.value = '2D';
        $(networkTypeSelect).append(option);

        var option = document.createElement('option');
        option.text = 'Circular';
        option.value = 'circular';
        $(networkTypeSelect).append(option);

        // Graph canvas setup
        this.graph2dContainer = d3.select('#div-svg-' + this.id)
            .append("div")
            //.attr("width", jDiv.width())
            //.attr("height", jDiv.height() - sliderSpace)
            .style({
                width: "100%",
                height: "100%",
                //position: "absolute",
                //right: "0px"
            })
            .classed("graph2dContainer", true)
            .node();

        // SVG Initializing
        var varSVGZoom = () => { this.svgZoom(); }
        this.svg = d3.select('#div-svg-' + this.id).append("svg")
            .attr("width", jDiv.width())
            .attr("height", jDiv.height() - sliderSpace)
            .call(this.d3Zoom.on("zoom", varSVGZoom));

        try {
            this.svg[0][0].setAttribute("id", "svgGraph" + this.id);
            this.svgAllElements = this.svg.append("g"); // svg Group of shapes

            // add arrow marker
            this.svgAllElements.append("defs").append("marker")
                .attr("id", "arrowhead-circular")
                .attr("refX", 0) /*must be smarter way to calculate shift*/
                .attr("refY", 2)
                .attr("markerWidth", 6)
                .attr("markerHeight", 4)
                .attr("orient", "auto")
                .attr("viewbox", "0 0 20 20")
                .append("path")
                .attr("d", "M 0,0 V 4 L6,2 Z"); //this is actual shape for arrowhead

            this.svgAllElements.append("defs").append("marker")
                .attr("id", "arrowhead-2d")
                .attr("refX", 8) /*must be smarter way to calculate shift*/
                .attr("refY", 2)
                .attr("markerWidth", 6)
                .attr("markerHeight", 4)
                .attr("orient", "auto")
                .attr("viewbox", "0 0 20 20")
                .append("path")
                .attr("d", "M 0,0 V 4 L6,2 Z"); //this is actual shape for arrowhead

            var varSvg = this.svg[0];
            var varNamespaceURI = varSvg[0].namespaceURI;
            this.svgDefs = document.createElementNS(varNamespaceURI, 'defs');

            this.createMarker();

            varSvg[0].appendChild(this.svgDefs);

            this.jDivProcessingNotification = document.createElement('div');
            this.jDivProcessingNotification.id = 'div-processing-notification';
        } catch (err) {
            console.log(err);
        }
    }

    setupInput() {
        // Register callbacks
        this.input.regKeyTickCallback('a', (deltaTime: number) => {

            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(0, -1, 0);
            quat.setFromAxisAngle(axis, this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quat, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quat, this.colaObject.quaternion);
        });

        this.input.regKeyTickCallback('d', (deltaTime: number) => {

            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(0, 1, 0);
            quat.setFromAxisAngle(axis, this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quat, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quat, this.colaObject.quaternion);
        });

        this.input.regKeyTickCallback('w', (deltaTime: number) => {

            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(-1, 0, 0);
            quat.setFromAxisAngle(axis, this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quat, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quat, this.colaObject.quaternion);
        });

        this.input.regKeyTickCallback('s', (deltaTime: number) => {

            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(1, 0, 0);
            quat.setFromAxisAngle(axis, this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quat, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quat, this.colaObject.quaternion);
        });

        var leapRotationSpeed = 0.03; // radians per mm
        this.input.regLeapXCallback((mm: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y, this.brainObject.rotation.z + leapRotationSpeed * mm);
            this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y, this.colaObject.rotation.z + leapRotationSpeed * mm);
        });

        this.input.regLeapYCallback((mm: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x - leapRotationSpeed * mm, this.brainObject.rotation.y, this.brainObject.rotation.z);
            this.colaObject.rotation.set(this.colaObject.rotation.x - leapRotationSpeed * mm, this.colaObject.rotation.y, this.colaObject.rotation.z);
        });

        this.input.regMouseDragCallback((dx: number, dy: number, mode: number) => {
            if (this.isControllingGraphOnly) return;

            // left button: rotation
            if (mode == 1) {
                if (this.autoRotation == false) {
                    var pixelAngleRatio = 50;

                    var quatX = new THREE.Quaternion();
                    var axisX = new THREE.Vector3(0, 1, 0);
                    quatX.setFromAxisAngle(axisX, dx / pixelAngleRatio); // axis must be normalized, angle in radians
                    this.brainObject.quaternion.multiplyQuaternions(quatX, this.brainObject.quaternion);
                    this.colaObject.quaternion.multiplyQuaternions(quatX, this.colaObject.quaternion);

                    var quatY = new THREE.Quaternion();
                    var axisY = new THREE.Vector3(1, 0, 0);
                    quatY.setFromAxisAngle(axisY, dy / pixelAngleRatio); // axis must be normalized, angle in radians
                    this.brainObject.quaternion.multiplyQuaternions(quatY, this.brainObject.quaternion);
                    this.colaObject.quaternion.multiplyQuaternions(quatY, this.colaObject.quaternion);
                }
                else {
                    this.mouse.dx = dx;
                    this.mouse.dy = dy;
                }
            }
            // right button: pan
            else if (mode == 3) {
                var pixelDistanceRatio = 1.6; // with: defaultCameraFov = 25; defaultViewWidth = 800;
                var defaultCameraFov = 25
                var defaultViewWidth = 800;

                // move brain model
                pixelDistanceRatio /= (this.camera.fov / defaultCameraFov);
                pixelDistanceRatio *= (this.currentViewWidth / defaultViewWidth);
                this.brainContainer.position.set(this.brainContainer.position.x + dx / pixelDistanceRatio, this.brainContainer.position.y - dy / pixelDistanceRatio, this.brainContainer.position.z);
                this.colaObject.position.set(this.colaObject.position.x + dx / pixelDistanceRatio, this.colaObject.position.y - dy / pixelDistanceRatio, this.colaObject.position.z);

                var prevQuaternion = this.brainContainer.quaternion.clone();
                this.brainContainer.lookAt(this.camera.position);
                

            }
        });

        this.input.regMouseLeftClickCallback((x: number, y: number) => {
            var oldSelectedNodeID = this.commonData.selectedNode;
            this.commonData.selectedNode = -1;

            // Check if pointer is over 3D Model
            var node = this.getNodeUnderPointer(this.input.localPointerPosition());
            this.getBoundingSphereUnderPointer(this.input.localPointerPosition());

            // Check if pointer is over 2D Model in all view
            var nodeIDUnderPointer = -1;
            for (var i = 0; i < this.commonData.nodeIDUnderPointer.length; i++) {
                if (this.commonData.nodeIDUnderPointer[i] != -1) {
                    nodeIDUnderPointer = this.commonData.nodeIDUnderPointer[i];
                    break;
                }
            }

            if (oldSelectedNodeID != -1) {

                // Deselect the previous selected node
                this.physioGraph.deselectNode(oldSelectedNodeID);
                this.colaGraph.deselectNode(oldSelectedNodeID);

                var varNodeID = oldSelectedNodeID;
                if (this.networkType == "circular") {
                    var varMouseOutedCircularLayout = (d) => { this.circularGraph.mouseOutedCircularLayout(d); };
                    this.svgAllElements.selectAll(".nodeCircular")
                        .each(function (d) {
                            if (varNodeID == d.id) varMouseOutedCircularLayout(d);
                        });
                }
                else if (this.networkType == "2D") {
                    this.svgNeedsUpdate = true;
                }

            }

            // If the pointer is pointing to any node in 2D or 3D graph
            if (node || (nodeIDUnderPointer != -1)) {
                this.commonData.selectedNode = node ? node.userData.id : nodeIDUnderPointer;

                // Select the new node
                this.physioGraph.selectNode(this.commonData.selectedNode, false, false);
                this.colaGraph.selectNode(this.commonData.selectedNode, this.ignore3dControl, true);


                var varNodeID = this.commonData.selectedNode;
                if (this.networkType == "circular") {
                    var varMouseOveredCircularLayout = (d) => { this.circularGraph.mouseOveredCircularLayout(d); };
                    this.svgAllElements.selectAll(".nodeCircular")
                        .each(function (d) {
                            if (varNodeID == d.id) varMouseOveredCircularLayout(d);
                        });
                }
                else if (this.networkType == "2D") {
                    this.svgNeedsUpdate = true;
                }
            }
        });

        this.input.regMouseRightClickCallback((x: number, y: number) => {
            if (this.isControllingGraphOnly) return;

            let record;
            var node = this.getNodeUnderPointer(this.input.localPointerPosition());
            if (node) {
                record = this.dataSet.getRecord(node.userData.id);
                record["color"] = (<any>node).material.color.getHex();
            }
            return record;
        });


        /* Double Click the viewport will reset the Model*/
        this.input.regMouseDoubleClickCallback(() => {
            if (this.isControllingGraphOnly) return;

            this.fovZoomRatio = 1;
            this.camera.fov = this.defaultFov;
            this.camera.updateProjectionMatrix();
            
            this.brainContainer.position.set(-this.graphOffset, 0, 0);
            this.brainContainer.lookAt(this.camera.position);
            this.brainObject.rotation.set(0, 0, 0);
            
            this.colaObject.position.set(this.graphOffset, 0, 0);
            this.colaObject.rotation.set(0, 0, 0);
        });

        /* Interact with mouse wheel will zoom in and out the 3D Model */
        this.input.regMouseWheelCallback((delta: number) => {
            const ZOOM_FACTOR = 10;

            if (this.isControllingGraphOnly) return; // 2D Flat Version of the network
            var pointer = this.input.localPointerPosition();
            var pointerNDC = new THREE.Vector3(pointer.x, pointer.y, 1);

            pointerNDC.unproject(this.camera);
            pointerNDC.sub(this.camera.position);

            if (delta < 0) {
                this.camera.position.addVectors(this.camera.position, pointerNDC.setLength(ZOOM_FACTOR));
            } else {
                this.camera.position.addVectors(this.camera.position, pointerNDC.setLength(-ZOOM_FACTOR));
            }
        });

        this.input.regGetRotationCallback(() => {
            var rotation: number[] = [];
            rotation.push(this.brainObject.rotation.x);
            rotation.push(this.brainObject.rotation.y);
            rotation.push(this.brainObject.rotation.z);
            return rotation;
        });

        this.input.regSetRotationCallback((rotation: number[]) => {
            if ((rotation) && (rotation.length == 3)) {
                this.brainObject.rotation.set(rotation[0], rotation[1], rotation[2]);
                this.colaObject.rotation.set(rotation[0], rotation[1], rotation[2]);
            }
        });

    }


    setBrainModelObject(modelObject) {
        this.brainModelOrigin = modelObject;
        this.setBrainMode(this.brainSurfaceMode);
    }


    setBrainMode(mode) {
        this.brainSurfaceMode = mode;
        let model = this.brainModelOrigin;
        this.surfaceUniformList = [];
        let uniformList = this.surfaceUniformList;
        /*
        var normalShader = {
            vertexShader: [

                "uniform float mode;",
                "varying vec3 vNormal;",
                "varying vec3 vPosition;" ,

                THREE.ShaderChunk["morphtarget_pars_vertex"],

                "void main() {",
                    "vPosition = position;",
                    "vNormal = normalize( normalMatrix * normal );",

                    THREE.ShaderChunk["morphtarget_vertex"],
                    THREE.ShaderChunk["default_vertex"],

                "}"

            ].join("\n"),

            fragmentShader: [
                "uniform float mode;",
                "uniform float opacity;",
                "varying vec3 vNormal;",
                "varying vec3 vPosition;" +

                "void main() {",
                    "if (vPosition.x * mode >= 0.0){",
                        "vec3 color = vec3(0.9, 0.9, 0.9);",
                        "float dotProduct = dot( normalize(vNormal), normalize(vec3(0,0,1)));",
                        "gl_FragColor = vec4( color * dotProduct, opacity );",
                    "}else{",
                        "discard;",
                    "}",
                "}"

            ].join("\n")

        };
        */

        // Remove the old mesh and add the new one (we don't need a restart)
        this.brainObject.remove(this.brainSurface);
        var clonedObject = new THREE.Object3D();
        var boundingSphereObject = new THREE.Object3D();

        let surfaceMaterial = new THREE.MeshLambertMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.5,
            depthWrite: true,
            depthTest: false,
            side: THREE.FrontSide
        });
        
        if (model) {
            // Default mode: full brain model 
            if (mode == 0) {

                // Clone the mesh - we can't share it between different canvases without cloning it
                model.traverse(function (child) {
                    if (child instanceof THREE.Mesh) {
                        /*
                        this.uniforms = {
                            opacity: { type: "f", value: 0.5 },
                            mode: { type: 'f', value: 0.0 }
                        };
                        uniformList.push(this.uniforms);
    
                        clonedObject.add(new THREE.Mesh(child.geometry.clone(), new THREE.ShaderMaterial(<any>{
                            uniforms: this.uniforms,
                            vertexShader: normalShader.vertexShader,
                            fragmentShader: normalShader.fragmentShader,
                            transparent: true
                        })));
                        */

                        clonedObject.add(new THREE.Mesh(child.geometry.clone(), surfaceMaterial));

                        child.geometry.computeBoundingSphere();
                        var boundingSphere = child.geometry.boundingSphere;
                        var sphereMaterial = child.material.clone();
                        sphereMaterial.visible = false;
                        var sphereGeometry = new THREE.SphereGeometry(boundingSphere.radius + 10, 10, 10);
                        var sphereObject = new THREE.Mesh(sphereGeometry, sphereMaterial);
                        sphereObject.position.copy(boundingSphere.center);
                        boundingSphereObject.add(sphereObject);
                    }
                });

                // Medial View
            } else if (mode === 1) {
                // Clone the mesh - we can't share it between different canvases without cloning it

                model.traverse(function (child) {
                    if (child instanceof THREE.Mesh) {
                        /*
                        this.leftUniforms = {
                            opacity: { type: "f", value: 0.5 },
                            mode: { type: 'f', value: -1.0 }
                        };
    
                        this.rightUniforms = {
                            opacity: { type: "f", value: 0.5 },
                            mode: { type: 'f', value: 1.0 }
                        };
    
                        uniformList.push(this.leftUniforms);
                        uniformList.push(this.rightUniforms);
    
                        // left brain
                        var leftBrain = new THREE.Mesh(child.geometry.clone(), new THREE.ShaderMaterial(<any>{
                            uniforms: this.leftUniforms,
                            vertexShader: normalShader.vertexShader,
                            fragmentShader: normalShader.fragmentShader,
                            transparent: true
                        }));
                        leftBrain.renderDepth = 2;
                        var rightBrain = new THREE.Mesh(child.geometry.clone(), new THREE.ShaderMaterial(<any>{
                            uniforms: this.rightUniforms,
                            vertexShader: normalShader.vertexShader,
                            fragmentShader: normalShader.fragmentShader,
                            transparent: true
                        }));
                        rightBrain.renderDepth = 2;
                        */
                        // Need to edit geometries to "slice" them in half
                        // Each face is represented by a group 9 values (3 vertices * 3 dimensions). Move to other side if any face touches the right side (i.e. x > 0).
                        var leftPositions = Array.prototype.slice.call(child.geometry.getAttribute("position").array);
                        var rightPositions = [];
                        const FACE_CHUNK = 9;
                        const VERT_CHUNK = 3;
                        let i = leftPositions.length - VERT_CHUNK;      // Start from last x position
                        while (i -= VERT_CHUNK) {
                            if (leftPositions[i] > 0) {
                                // Move whole face to other geometry
                                var faceStart = Math.floor(i / FACE_CHUNK) * FACE_CHUNK;
                                rightPositions.push(...leftPositions.splice(faceStart, FACE_CHUNK));
                                i = faceStart;
                            }
                        }

                        var leftGeometry = new THREE.BufferGeometry;
                        leftGeometry.addAttribute("position", new THREE.BufferAttribute(new Float32Array(leftPositions), VERT_CHUNK));
                        leftGeometry.computeVertexNormals();
                        leftGeometry.computeFaceNormals();
                        var leftBrain = new THREE.Mesh(leftGeometry, surfaceMaterial);

                        var rightGeometry = new THREE.BufferGeometry;
                        rightGeometry.addAttribute("position", new THREE.BufferAttribute(new Float32Array(rightPositions), VERT_CHUNK));
                        rightGeometry.computeVertexNormals();
                        rightGeometry.computeFaceNormals();
                        var rightBrain = new THREE.Mesh(rightGeometry, surfaceMaterial);

                        var box = new THREE.Box3()['setFromObject'](model);
                        leftBrain.rotation.z = 3.14 / 2;
                        rightBrain.rotation.z = -3.14 / 2;

                        // center the brain along y axis
                        var mean = (box.max.z - box.min.z) / 2;
                        var offsetToHead = box.max.z - mean;
                        var offsetDistance = 10;
                        leftBrain.translateY(offsetToHead);
                        rightBrain.translateY(offsetToHead);

                        leftBrain.translateZ(-(box.max.z + offsetDistance));
                        rightBrain.translateZ(Math.abs(box.min.z) + offsetDistance);

                        clonedObject.add(leftBrain);
                        clonedObject.add(rightBrain);

                        child.geometry.computeBoundingSphere();
                        var boundingSphere = child.geometry.boundingSphere;
                        var material = child.material.clone();
                        material.visible = false;
                        var sphereGeometry = new THREE.SphereGeometry(boundingSphere.radius + 10, 10, 10);
                        var sphereObject = new THREE.Mesh(sphereGeometry, material);
                        sphereObject.position.copy(boundingSphere.center);

                        boundingSphereObject.add(sphereObject);
                    }
                });

            } else {
                console.log("ERROR: Wrong Brain Surface Mode");
                return;
            }
        }

        clonedObject.renderOrder = RENDER_ORDER_BRAIN;
        this.brainSurface = clonedObject;
        this.brainObject.add(this.brainSurface);
        
        this.brainSurfaceBoundingSphere = boundingSphereObject;
        this.brainObject.add(this.brainSurfaceBoundingSphere);
        this.surfaceLoaded = true;
        
        // update Physio Graph if exists
        if (!this.dataSet) return;
        if (this.brainSurfaceMode === 0) {
            this.filteredAdjMatrix = this.dataSet.adjMatrixFromEdgeCount(Number(this.edgeCountSliderValue));
        } else {
            this.filteredAdjMatrix = this.dataSet.adjMatrixWithoutEdgesCrossHemisphere(Number(this.edgeCountSliderValue));
        }
        this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    }

    setSurfaceOpacity(opacity: number) {
        for (let object of this.brainSurface.children) {
            object.material.opacity = opacity;
            object.material.needsUpdate = true;
        }
    }

    setSurfaceColor(color: string) {
        for (let object of this.brainSurface.children) {
            object.material.color.set(color);
        }
    }

    getDrawingCanvas() {
        if (this.renderer) return this.renderer.domElement;
    }

    save(app: SaveApp) {
        app.edgeCount = this.edgeCountSliderValue;
        app.brainSurfaceMode = this.brainSurfaceMode;
        app.showingTopologyNetwork = this.showingTopologyNetwork;
        app.networkType = this.networkType;

        if (this.circularGraph) {
            app.circularBundleAttribute = this.circularGraph.circularBundleAttribute;
            app.circularSortAttribute = this.circularGraph.circularSortAttribute;
            app.circularLableAttribute = this.circularGraph.circularLableAttribute;
            app.circularAttributeBars = this.circularGraph.attributeBars;
        } else {
            console.log("ERROR: circularGraph is NULL");
        }
    } 

    initEdgeCountSlider(app: SaveApp) {
        this.edgeCountSliderOnChange(app.edgeCount);
        $('#edge-count-slider-' + this.id).val(<any>app.edgeCount);
    }

    initShowNetwork(app: SaveApp) {
        
        if (app.showingTopologyNetwork) {
            $('#select-network-type-' + this.id).val(app.networkType);
            this.networkTypeOnChange(app.networkType);

            if (app.networkType == "circular") {
                $('#select-circular-layout-bundle-' + this.id).val(app.circularBundleAttribute);
                $('#select-circular-layout-sort-' + this.id).val(app.circularSortAttribute);
                $('#select-circular-label-' + this.id).val(app.circularLableAttribute);
                $('#checkbox-circular-edge-gradient-' + this.id).prop('checked', app.circularEdgeGradient);

                if (app.circularAttributeBars && app.circularAttributeBars.length > 0) {
                    for (var bar in app.circularAttributeBars) {
                        this.circularGraph.addAttributeBar();
                    }

                    for (var barIndex in app.circularAttributeBars) {
                        $('#select-circular-layout-attribute-' + app.circularAttributeBars[barIndex].id + '-' + this.id).val(app.circularAttributeBars[barIndex].attribute);
                        $('#input-circular-layout-bar' + app.circularAttributeBars[barIndex].id + '-color').val(app.circularAttributeBars[barIndex].color.substring(1));
                        this.circularGraph.circularLayoutAttributeOnChange(app.circularAttributeBars[barIndex].id, app.circularAttributeBars[barIndex].attribute);
                        this.circularGraph.updateCircularBarColor(app.circularAttributeBars[barIndex].id, app.circularAttributeBars[barIndex].color);
                    }
                }

                this.circularGraph.circularBundleAttribute = app.circularBundleAttribute;
                this.circularGraph.circularSortAttribute = app.circularSortAttribute;
                this.circularGraph.circularLableAttribute = app.circularLableAttribute;
                this.circularGraph.updateAllAttributeBars();

                this.showNetwork(true);
            }
        }
    }

    sliderMouseEvent(e: string) {
        if (e == "mousedown") {
            this.input.sliderEvent = true;
        }
        else if (e == "mouseup"){
            this.input.sliderEvent = false;
        }
    }

    closeBrainAppOnClick() {
        this.jDiv.empty();

        if (this.id == 0) {
            this.jDiv.css({ backgroundColor: '#ffe5e5' });
        }
        else if (this.id == 1) {
            this.jDiv.css({ backgroundColor: '#d7e8ff' });
        }
        else if (this.id == 2) {
            this.jDiv.css({ backgroundColor: '#fcffb2' });
        }
        else if (this.id == 3) {
            this.jDiv.css({ backgroundColor: '#d2ffbd' });
        }

        this.deleted = true;
    }

    /* This function is linked with html codes and called when the new option is selected */
    networkTypeOnChange(type: string) {
        this.networkType = type;

        if (type === "circular" && this.circularGraph) {
            this.circularGraph.setupOptionMenuUI(); // add options button to the page
            this.svg.attr("visibility", "visible");
            $(this.graph2dContainer).hide();
        } else {
            // hide options button
            $('#button-circular-layout-histogram-' + this.id).hide();
        }

        if (type === "2D" && this.canvasGraph) {
            this.canvasGraph.setupOptionMenuUI(); // add options button to the page
            this.svg.attr("visibility", "hidden");
            $(this.graph2dContainer).show();
        } else {
            // hide options button
            $('#button-graph2d-option-menu-' + this.id).hide();
        }


        if (this.colaGraph && this.colaGraph.isVisible()) {
            this.showNetwork(true);
        }
        else {
            this.showNetwork(false);
        }
    }

    defaultOrientationsOnClick(orientation: string) {
        if (!orientation) return;

        switch (orientation) {
            case "top":
                this.brainObject.rotation.set(0,0,0);
                this.colaObject.rotation.set(0,0,0);                
                break;
            case "bottom":
                this.brainObject.rotation.set(0, Math.PI, 0);
                this.colaObject.rotation.set(0, Math.PI, 0);                  
                break;
            case "left":
                this.brainObject.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
                this.colaObject.rotation.set(-Math.PI / 2, 0, Math.PI / 2);          
                break;
            case "right":
                this.brainObject.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
                this.colaObject.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);  
                break;
            case "front":
                this.brainObject.rotation.set(-Math.PI / 2, 0, Math.PI);
                this.colaObject.rotation.set(-Math.PI / 2, 0, Math.PI);    
                break;
            case "back":
                this.brainObject.rotation.set(-Math.PI / 2, 0, 0);
                this.colaObject.rotation.set(-Math.PI / 2, 0, 0);    
                break;
        }
    }

    graphViewSliderOnChange(value: number) {
        this.colaGraph.setNodePositionsLerp(this.physioGraph.nodePositions, this.colaCoords, value/100);
    }

    edgeCountSliderOnChange(numEdges) {
        this.edgeCountSliderValue = numEdges;
        if (!this.dataSet.sortedSimilarities) return;

        let max = this.dataSet.sortedSimilarities.length;
        if (numEdges > max) numEdges = max;
        let $count = $('#count-' + this.id).get(0);
        if ($count) $count.textContent = numEdges;
        let percentile = numEdges * 100 / max;
        let $percentile = $('#percentile-' + this.id).get(0);
        if ($percentile) $percentile.textContent = percentile.toFixed(2);
        if (this.brainSurfaceMode === 0) {
            this.filteredAdjMatrix = this.dataSet.adjMatrixFromEdgeCount(numEdges);
        } else {
            this.filteredAdjMatrix = this.dataSet.adjMatrixWithoutEdgesCrossHemisphere(numEdges);
        }
        if (this.physioGraph) {
            this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
            this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        }

    }

    edgeThicknessByWeightOnChange(bool: boolean) {
        if ((!this.physioGraph) || (!this.colaGraph)) return;

        this.weightEdges = bool;

        this.physioGraph.edgeThicknessByWeight = this.weightEdges;
        this.colaGraph.edgeThicknessByWeight = this.weightEdges;

        if (this.weightEdges) {
            $('#weight-edges-' + this.id).css('opacity', 1);
        }
        else {
            $('#weight-edges-' + this.id).css('opacity', 0.2);
        }

        this.svgNeedsUpdate = true;
    }

    edgeColorOnChange(colorMode: string, config?) {
        if ((!this.physioGraph) || (!this.colaGraph)) return;
        this.colorMode = colorMode;


        this.physioGraph.setEdgeColorConfig(this.colorMode, config);
        this.colaGraph.setEdgeColorConfig(this.colorMode, config);
        if (this.circularGraph) this.circularGraph.circularLayoutEdgeColorModeOnChange(colorMode);
        
        this.svgNeedsUpdate = true;
        this.needUpdate = true;
    }

    edgesBundlingOnChange() {
        if ((!this.physioGraph) || (!this.colaGraph)) {
            this.removeProcessingNotification();
            return;
        }

        this.bundlingEdges = !this.bundlingEdges;

        if (this.bundlingEdges) {
            $('#bundling-edges-' + this.id).css('opacity', 1);
        }
        else {
            $('#bundling-edges-' + this.id).css('opacity', 0.2);

            this.physioGraph.removeAllBundlingEdges();
            this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
            this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        }

        this.removeProcessingNotification();
    }

    showProcessingNotification() {
        //$('body').css({ cursor: 'wait' });

        document.body.appendChild(this.jDivProcessingNotification);
        $('#div-processing-notification').empty(); // empty this.rightClickLabel

        this.jDivProcessingNotification.style.position = 'absolute';
        this.jDivProcessingNotification.style.left = '50%';
        this.jDivProcessingNotification.style.top = '50%';
        this.jDivProcessingNotification.style.padding = '5px';
        this.jDivProcessingNotification.style.borderRadius = '2px';
        this.jDivProcessingNotification.style.zIndex = '1';
        this.jDivProcessingNotification.style.backgroundColor = '#feeebd'; // the color of the control panel

        var text = document.createElement('div');
        text.innerHTML = "Processing...";
        this.jDivProcessingNotification.appendChild(text);
    }

    removeProcessingNotification() {
        if ($('#div-processing-notification').length > 0)
            document.body.removeChild(this.jDivProcessingNotification);
    }

    autoRotationOnChange(s: string) {
        this.autoRotation = !this.autoRotation;

        this.mouse.dx = 0;
        this.mouse.dy = 0;

        // set default rotation
        if (this.autoRotation) {
            $('#anti-auto-rotation-' + this.id).css('opacity', 1);
            if (s == "anticlockwise") {
                this.mouse.dx = 1;
                this.mouse.dy = 0;
            }
        } else {
            $('#anti-auto-rotation-' + this.id).css('opacity', 0.2);
        }
    }

    allLabelsOnChange() {
        if ((!this.physioGraph) || (!this.colaGraph)) return;

        this.allLabels = !this.allLabels;

        this.physioGraph.allLabels = this.allLabels;
        this.colaGraph.allLabels = this.allLabels;

        if (this.allLabels) {
            $('#all-labels-' + this.id).css('opacity', 1);
            this.physioGraph.showAllLabels(false, false);
            this.colaGraph.showAllLabels(this.ignore3dControl, true);
        }
        else {
            $('#all-labels-' + this.id).css('opacity', 0.2);
            this.physioGraph.hideAllLabels();
            this.colaGraph.hideAllLabels();
        }

        this.svgNeedsUpdate = true;
    }

    showNetwork(switchNetworkType: boolean) {
        if (!this.brainObject || !this.colaObject || !this.physioGraph || !this.colaGraph) return;

        // Change the text of the button to "Topology"
        $('#button-show-network-' + this.id).text("Topology"); 

        this.showingTopologyNetwork = true; 

        if (this.bundlingEdges) this.edgesBundlingOnChange(); // turn off edge bundling

        if (!this.transitionInProgress) {
            // Leave *showingCola* on permanently after first turn-on
            //this.showingCola = true;

            var edges = [];
            this.colaGraph.filteredNodeIDs = this.physioGraph.filteredNodeIDs;
            this.colaGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, edges);
            this.colaGraph.setNodeVisibilities(); // Hide the nodes without neighbours
            this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix); // Hide the edges that have not been selected
            if (this.allLabels) {
                this.colaGraph.showAllLabels(this.ignore3dControl, true);
            }
            //-------------------------------------------------------------------------------------------------------------
            // 3d cola graph

            var getSourceIndex = function (e) {
                return e.source;
            }

            var getTargetIndex = function (e) {
                return e.target;
            }

            var varType = this.networkType;
            var getLength = function (e) {
                return 1;
            }
            
            // Create the distance matrix that Cola needs
            var distanceMatrix = (new cola.shortestpaths.Calculator(this.dataSet.info.nodeCount, edges, getSourceIndex, getTargetIndex, getLength)).DistanceMatrix();
            var D = cola.Descent.createSquareMatrix(this.dataSet.info.nodeCount, (i, j) => {
                return distanceMatrix[i][j] * this.colaLinkDistance;
            });

            var clonedPhysioCoords = this.dataSet.brainCoords.map(function (dim) {
                return dim.map(function (element) {
                    return element;
                });
            });
            this.descent = new cola.Descent(clonedPhysioCoords, D); // Create the solver

            var originColaCoords: number[][];
            if (switchNetworkType) {
                if (this.colaCoords) {
                    originColaCoords = this.colaCoords.map(function (array) {
                        return array.slice(0);
                    });
                }
            }
            else {
                originColaCoords = this.dataSet.brainCoords.map(function (array) {
                    return array.slice(0);
                });
            }

            this.colaCoords = this.descent.x; // Hold a reference to the solver's coordinates
            // Relieve some of the initial stress
            for (var i = 0; i < 10; ++i) {
                this.descent.reduceStress();
            }

            // clear svg graphs
            if (this.ignore3dControl) {
                // clear  circular
                this.circularGraph.clear();

                this.ignore3dControl = false;
            }

            //-------------------------------------------------------------------------------------------------------------
            // animation
            if (this.networkType == 'circular') { // There's no animation for this ... 
                this.ignore3dControl = true;
                this.svgNeedsUpdate = true;
                this.colaGraph.setVisible(false); // turn off 3D and 2D graph

                if ($('#select-circular-layout-bundle-' + this.id).length <= 0) return;
                if ($('#select-circular-layout-sort-' + this.id).length <= 0) return;

                // Update Cola Graph used in Circular Graph and then recreate it
                // update share data
                this.circularGraph.circularEdgeColorMode = this.colorMode;
                this.circularGraph.circularEdgeDirectionMode = this.directionMode;
                this.circularGraph.setColaGraph(this.physioGraph);
                this.circularGraph.create();

            } else if (this.networkType == '2D') {
                // Also not animated
                this.ignore3dControl = true;
                this.canvasGraph.updateGraph();
                this.colaGraph.setVisible(false);
            } else { // this.network === "3D"
                // Set up a coroutine to do the animation
                var origin = new THREE.Vector3(this.brainContainer.position.x, this.brainContainer.position.y, this.brainContainer.position.z);
                var target = new THREE.Vector3(this.brainContainer.position.x + 2 * this.graphOffset, this.brainContainer.position.y, this.brainContainer.position.z);

                this.colaObjectAnimation(origin, target, originColaCoords, this.colaCoords, switchNetworkType, true);                
            }
        }
    }

    cross(u: number[], v: number[]) {
        if (!u || !v) return;

        var u1 = u[0];
        var u2 = u[1];
        var u3 = u[2];
        var v1 = v[0];
        var v2 = v[1];
        var v3 = v[2];

        var cross = [u2 * v3 - u3 * v2, u3 * v1 - u1 * v3, u1 * v2 - u2 * v1];
        return cross;
    }

    angle(u: number[], v: number[]) {
        if (!u || !v) return;
        var costheta = numeric.dot(u, v) / (numeric.norm2(u) * numeric.norm2(v));
        var theta = Math.acos(costheta);
        return theta;
    }

    threeToSVGAnimation(transitionFinish: boolean) {
        this.colaGraph.setVisible(false);
        this.ignore3dControl = true;
        this.svgNeedsUpdate = true;
        this.transitionInProgress = false;

        // Enable the vertical slider
        $('#graph-view-slider-' + this.id).css({ visibility: 'visible' });
        $('#graph-view-slider-' + this.id).val('100');

        $('#button-show-network-' + this.id).prop('disabled', false);
        $('#select-network-type-' + this.id).prop('disabled', false);
        $('#graph-view-slider-' + this.id).prop('disabled', false);
    }

    colaObjectAnimation(colaObjectOrigin, colaObjectTarget, nodeCoordOrigin: number[][], nodeCoordTarget: number[][], switchNetworkType: boolean, transitionFinish: boolean) {
        this.colaGraph.setVisible(true);

        // turn the opacity on again 
        this.colaGraph.setEdgeOpacity(1);
        var children = this.colaGraph.rootObject.children;
        for (var i = 0; i < children.length; i++) {
            children[i].material.opacity = 1;
        }

        this.transitionInProgress = true;
        $('#button-show-network-' + this.id).prop('disabled', true);
        $('#select-network-type-' + this.id).prop('disabled', true);    
        $('#graph-view-slider-' + this.id).prop('disabled', true); 

        if (switchNetworkType) {
            this.colaObject.position.copy(colaObjectTarget);
        } else {
            this.colaObject.position.copy(colaObjectOrigin);
        }

        setCoroutine({ currentTime: 0, endTime: this.modeLerpLength }, (o, deltaTime) => {
            o.currentTime += deltaTime;

            if (o.currentTime >= o.endTime) { // The animation has finished
                this.colaObject.position.copy(colaObjectTarget);
                this.colaGraph.setNodePositions(nodeCoordTarget);

                if (transitionFinish) {
                    this.transitionInProgress = false;
                    this.needUpdate = true;

                    // Enable the vertical slider
                    $('#graph-view-slider-' + this.id).css({ visibility: 'visible' });
                    $('#graph-view-slider-' + this.id).val('100');

                    $('#button-show-network-' + this.id).prop('disabled', false);
                    $('#select-network-type-' + this.id).prop('disabled', false);
                    $('#graph-view-slider-' + this.id).prop('disabled', false); 
                }
                
                return true;
            }
            else { // Update the animation
                var percentDone = o.currentTime / o.endTime;
                this.needUpdate = true;
                this.colaGraph.setNodePositionsLerp(nodeCoordOrigin, nodeCoordTarget, percentDone);

                if (switchNetworkType == false) {
                    var pos = colaObjectOrigin.clone().add(colaObjectTarget.clone().sub(colaObjectOrigin).multiplyScalar(percentDone));
                    this.colaObject.position.set(pos.x, pos.y, pos.z);
                }

                return false;
            }
        });
    }
  
    svgZoom() {
        if (this.isControllingGraphOnly) {
            this.svgAllElements.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
            //if (this.networkType == "2D") this.svgNeedsUpdate = true;
        }
    }
   


    mouseOveredSetNodeID(id) {
        this.commonData.nodeIDUnderPointer[4] = id;
    }

    mouseOutedSetNodeID() {
        this.commonData.nodeIDUnderPointer[4] = -1;
    }

   
    createSVGLinearGradient(id, stops) {
        var svgNS = this.svg.namespaceURI;
        var grad = document.createElementNS(svgNS, 'linearGradient');
        grad.setAttribute('id', id);
        for (var i = 0; i < stops.length; i++) {
            var attrs = stops[i];
            var stop = document.createElementNS(svgNS, 'stop');
            for (var attr in attrs) {
                if (attrs.hasOwnProperty(attr)) stop.setAttribute(attr, attrs[attr]);
            }
            grad.appendChild(stop);
        }

        this.svgDefs.appendChild(grad);
    }

    createMarker() {
        var svgNS = this.svg.namespaceURI;
        var path = document.createElementNS(svgNS, 'path');
        path.setAttribute("d", "M 0,0 V 4 L6,2 Z");

        var marker = document.createElementNS(svgNS, 'marker');
        marker.setAttribute("id", "markerArrow");
        marker.setAttribute("markerWidth", "30");
        marker.setAttribute("markerHeight", "30");
        marker.setAttribute("refx", "2");
        marker.setAttribute("refy", "7");
        marker.setAttribute("orient", "auto");

        marker.appendChild(path);

        this.svgDefs.appendChild(marker);
    }
    
    isDeleted() {
        return this.deleted;
    }

    applyFilter(filteredIDs: number[]) {
        if (!this.dataSet || !this.dataSet.attributes) return;

        if (this.bundlingEdges) this.edgesBundlingOnChange(); // turn off edge bundling

        this.physioGraph.filteredNodeIDs = filteredIDs;
        this.physioGraph.applyNodeFiltering();
        this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        
    }

    //////////////////////////////////////////////////
    /// Node Attributes //////////////////////////////
    //////////////////////////////////////////////////
    highlightSelectedNodes(filteredIDs: number[]) {
        if (!this.dataSet || !this.dataSet.attributes) return;

        this.physioGraph.highlightSelectedNodes(filteredIDs);
        this.colaGraph.highlightSelectedNodes(filteredIDs);

        this.svgNeedsUpdate = true;
    }

    setNodeDefaultSizeColor() {
        // set default node color and scale
        this.physioGraph.setDefaultNodeColor();
        this.colaGraph.setDefaultNodeColor();

        this.physioGraph.setDefaultNodeScale();
        this.colaGraph.setDefaultNodeScale();

        this.svgNeedsUpdate = true;
    }

    setNodeSize(scaleArray: number[]) {
        this.physioGraph.setNodesScale(scaleArray);
        this.colaGraph.setNodesScale(scaleArray);

        this.svgNeedsUpdate = true;
    }

    setANodeColor(nodeID: number, color: string) {
        var value = parseInt(color.replace("#", "0x"));

        this.physioGraph.setNodeColor(nodeID, value);
        this.colaGraph.setNodeColor(nodeID, value);

        this.svgNeedsUpdate = true;
    }

    setNodeColor(attribute: string, minColor: string, maxColor: string) {
        
        if (!attribute || !minColor || !maxColor) {
            throw "Invalid arguments for setNodeColor."
        }
        if (!this.dataSet || !this.dataSet.attributes) {
            alert("Dataset is not loaded or does not contain attributes.")
            return;
        }
        var attrArray = this.dataSet.attributes.get(attribute);
        if (!attrArray) {
            throw "Attribute " + attribute + " does not exist.";
        }
        var columnIndex = this.dataSet.attributes.columnNames.indexOf(attribute);

        // assume all positive numbers in the array
        var min = this.dataSet.attributes.getMin(columnIndex);
        var max = this.dataSet.attributes.getMax(columnIndex);
        
        var colorArray: number[];
        if (attrArray[0].length > 1) {
            var colorMap = d3.scale.linear().domain([Math.log(min), Math.log(max)]).range([minColor, maxColor]);
            colorArray = attrArray.map((value: number[]) => {
                var str = colorMap(value.indexOf(Math.max.apply(Math,value))).replace("#", "0x");
                return parseInt(str);
            });
        }
        else {
            var colorMap = d3.scale.linear().domain([min, max]).range([minColor, maxColor]);
            colorArray = attrArray.map((value: number[]) => {
                var str = colorMap(Math.max.apply(Math, value)).replace("#", "0x");
                return parseInt(str);
            });

        }
        if (!colorArray) {
            throw "Encountered error in generating color array.";
        }

        // update graphs
        if (this.physioGraph) this.physioGraph.setNodesColor(colorArray);
        if(this.colaGraph) this.colaGraph.setNodesColor(colorArray);

        this.svgNeedsUpdate = true; // update to change node color
    }

    setNodeColorDiscrete(attribute: string, keyArray: number[], colorArray: string[]) {
        if (!attribute) return;
        if (!this.dataSet || !this.dataSet.attributes) return;

        var attrArray = this.dataSet.attributes.get(attribute);
        if (!attrArray) return;

        var colorArrayNum: number[];
        var colorMap = d3.scale.ordinal().domain(keyArray).range(colorArray);

        if (attrArray[0].length > 1) {
            colorArrayNum = attrArray.map((value: number[]) => {
                var color = 0;
                var counter = 0;
                value.forEach(function (v,i) {
                    if (v > 0) {
                        color += parseInt(colorMap(i).replace("#", "0x"));
                        counter++;
                    }
                });
                return Math.round(color / counter);
            });
        } else {
            colorArrayNum = attrArray.map((value: number[]) => {
                var str = colorMap(Math.max.apply(Math, value)).replace("#", "0x");
                return parseInt(str);
            });
        }

        if (!colorArrayNum) return;

        if (this.physioGraph) this.physioGraph.setNodesColor(colorArrayNum);
        if (this.colaGraph) this.colaGraph.setNodesColor(colorArrayNum);

        this.svgNeedsUpdate = true ;

    }

    //////////////////////////////////////////////////
    /// Edge Attributes //////////////////////////////
    //////////////////////////////////////////////////
    getCurrentEdgeWeightRange() {
        var range = {
            min: this.physioGraph.edgeMinWeight,
            max: this.physioGraph.edgeMaxWeight
        }

        return range;
    }

    setEdgeSize(size: number) {
        this.physioGraph.setEdgeScale(size);
        this.colaGraph.setEdgeScale(size);

        this.svgNeedsUpdate = true;
        this.needUpdate = true;
    }

    setEdgeThicknessByWeight(bool: boolean) {
        this.edgeThicknessByWeightOnChange(bool);
        this.needUpdate = true;
    }

    setEdgeColorByWeight(config) {
        var colorMode = "weight";
        this.edgeColorOnChange(colorMode, config);
        this.needUpdate = true;
    }
    

    setEdgeColorByNode() {
        var colorMode = "node";
        this.edgeColorOnChange(colorMode);
        this.needUpdate = true;
    }

    setEdgeNoColor() {
        var colorMode = "none";
        this.edgeColorOnChange(colorMode);
        this.needUpdate = true;
    }

    setEdgeDirectionGradient() {
        if (this.physioGraph) this.physioGraph.setEdgeDirectionGradient();
        if (this.colaGraph) this.colaGraph.setEdgeDirectionGradient();
        if (this.circularGraph) this.circularGraph.update();

        this.needUpdate = true;
    }

    /* Called when the size of the view port is changed*/
    resize(width: number, height: number) {
        // Resize the renderer
        this.renderer.setSize(width, height - sliderSpace);
        this.currentViewWidth = width;

        this.svg
            .attr("width", width)
            .attr("height", height - sliderSpace);

        // Calculate the aspect ratio
        var aspect = width / (height - sliderSpace);
        this.camera.aspect = aspect;

        // Calculate the FOVs
        var verticalFov = Math.atan(height / window.outerHeight); // Scale the vertical fov with the vertical height of the window (up to 45 degrees)
        var horizontalFov = verticalFov * aspect;

        this.defaultFov = verticalFov * 180 / Math.PI;

        this.camera.fov = this.defaultFov * this.fovZoomRatio;
        this.camera.updateProjectionMatrix();

        // Work out how far away the camera needs to be
        var distanceByH = (widthInCamera / 2) / Math.tan(horizontalFov / 2);
        var distanceByV = (heightInCamera / 2) / Math.tan(verticalFov / 2);

        // Select the maximum distance of the two
        this.camera.position.set(0, 0, Math.max(distanceByH, distanceByV));
        this.originalCameraPosition = this.camera.position.clone();
    }

    setDataSet(dataSet: DataSet) {
        this.dataSet = dataSet;
        if (this.dataSet.sortedSimilarities) {
            // Update slider max value
            if (this.dataSet.sortedSimilarities.length < maxEdgesShowable) {
                $("#edge-count-slider-" + this.id).prop("max", this.dataSet.sortedSimilarities.length);
            } else {
                $("#edge-count-slider-" + this.id).prop("max", maxEdgesShowable);
            }
            // update Circular Dataset
            this.circularGraph.setDataSet(dataSet);
        }

        var sim = () => {
            this.restart();
        };
        var att = () => {
            this.restart(); // TODO: We're currently destroying the entire graph to switch out the node group information - we can do better than that
        };
        dataSet.regNotifySim(sim);
        dataSet.regNotifyAttributes(att);
        if (dataSet.simMatrix && dataSet.attributes && this.physioGraph) {
            this.restart();
            this.physioGraph.update();
        } else {
            console.log("Warning: attempted to set dataset before minimal data is available.");
        }
    }

    // Initialize or re-initialize the visualisation.
    restart() {
        if (!this.dataSet || !this.dataSet.verify()) return;
        console.log("Restarted view: " + this.id);

        // Create the dissimilarity matrix from the similarity matrix (we need dissimilarity for Cola)
        for (var i = 0; i < this.dataSet.simMatrix.length; ++i) {
            this.dissimilarityMatrix.push(this.dataSet.simMatrix[i].map((sim) => {
                //return 15 / (sim + 1); // Convert similarities to distances
                return 0.5 / (sim * sim); 
            }));
        }

        // Set up the node colorings
        let nodeColors = this.getNodeColors();

        // Set up loop

        // Set up the graphs
        var edgeMatrix = this.dataSet.adjMatrixFromEdgeCount(maxEdgesShowable); // Don't create more edges than we will ever be showing

        if (this.physioGraph) this.physioGraph.destroy();
        this.physioGraph = new Graph3D(this.brainObject, edgeMatrix, nodeColors, this.dataSet.simMatrix, this.dataSet.brainLabels, this.commonData, this.saveObj);

        if (this.brainSurfaceMode === 0) {
            this.physioGraph.setNodePositions(this.dataSet.brainCoords);
        } else if (this.brainSurfaceMode === 1) {
            var newCoords = this.computeMedialViewCoords();
            this.physioGraph.setNodePositions(newCoords);
        } else {
            console.log("ERROR: Wrong Brain Surface Mode");
        }

        edgeMatrix = this.dataSet.adjMatrixFromEdgeCount(maxEdgesShowable);
        if (this.colaGraph) this.colaGraph.destroy();
        this.colaGraph = new Graph3D(this.colaObject, edgeMatrix, nodeColors, this.dataSet.simMatrix, this.dataSet.brainLabels, this.commonData, this.saveObj);
        this.colaGraph.setVisible(false);
        
        this.canvasGraph = new Graph2D(this.id, this.jDiv, this.dataSet, this.graph2dContainer, this.commonData, this.saveObj, this.physioGraph, this.camera, this.edgeCountSliderValue);

        // Initialize the filtering
        if (this.brainSurfaceMode === 0) {
            this.filteredAdjMatrix = this.dataSet.adjMatrixFromEdgeCount(Number(this.edgeCountSliderValue));
        } else {
            this.filteredAdjMatrix = this.dataSet.adjMatrixWithoutEdgesCrossHemisphere(Number(this.edgeCountSliderValue));
        }
        this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.colaGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.edgeCountSliderOnChange(Number(this.edgeCountSliderValue));
        
        
        // Enable the slider
        $('#edge-count-slider-' + this.id).prop('disabled', false);
        $('#edge-count-slider-' + this.id).val("" + this.edgeCountSliderValue);
        $('#button-show-network-' + this.id).prop('disabled', false);
        $('#select-network-type-' + this.id).prop('disabled', false);

    }

    computeMedialViewCoords() {
        var newCoords = [[], [], []];
        var zAxis = new THREE.Vector3(0, 0, 1);
        var box;
        if (this.brainModelOrigin) {
            box = new THREE.Box3()['setFromObject'](this.brainModelOrigin);
        }
        else {
            box = new THREE.Box3(new THREE.Vector3(-70, -100, -50), new THREE.Vector3(70, 70, 100));
        }
        var mean = (box.max.z - box.min.z) / 2;
        var offsetToHead = box.max.z - mean;

        for (var i = 0; i < this.dataSet.brainCoords[0].length; i++) {

            var coord = new THREE.Vector3(this.dataSet.brainCoords[0][i],
                this.dataSet.brainCoords[1][i],
                this.dataSet.brainCoords[2][i]);

            if (coord.x < 0) { // right
                coord.applyAxisAngle(zAxis, Math.PI / 2);
                coord.x = coord.x - offsetToHead;
                coord.z = coord.z - box.max.z;
            } else { // left
                coord.applyAxisAngle(zAxis, -Math.PI / 2);
                coord.x = coord.x + offsetToHead;
                coord.z = coord.z + Math.abs(box.min.z);
            }

            newCoords[0].push(coord.x);
            newCoords[1].push(coord.y);
            newCoords[2].push(coord.z);
        }
        return newCoords;
    }

    getNodeUnderPointer = pointer => {
        let raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, this.camera);

        let nCola = (this.colaGraph && this.colaGraph.nodeMeshes) || [];
        let nPhysio = (this.physioGraph && this.physioGraph.nodeMeshes) || [];

        let n = raycaster.intersectObjects(nCola)[0] || raycaster.intersectObjects(nPhysio)[0];
        if (n) {
            this.commonData.nodeIDUnderPointer[this.id] = n.object.userData.id;
            return n.object;
        }

        this.commonData.nodeIDUnderPointer[this.id] = -1;
        return null;
    }

    getBoundingSphereUnderPointer(pointer) {
        if ((this.networkType == '2D') || (this.networkType == 'circular')) {
            var raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(pointer, this.camera);
            
            var inBoundingSphere = !!(raycaster.intersectObject(this.brainSurfaceBoundingSphere, true).length);
            if (inBoundingSphere) {
                this.isControllingGraphOnly = false;
                this.svg.on(".zoom", null);
                this.canvasGraph.setUserControl(false);
            }
            else {
                this.isControllingGraphOnly = true;
                var varSVGZoom = () => { this.svgZoom(); }
                this.svg.call(this.d3Zoom.on("zoom", varSVGZoom));
                this.canvasGraph.setUserControl(true);
            }
        } else {
            this.isControllingGraphOnly = false;
            this.svg.on(".zoom", null);
            if (this.canvasGraph) this.canvasGraph.setUserControl(true);
        }
    }

    update(deltaTime: number) {
        // Execute coroutines
        if ((this.physioGraph) && (this.colaGraph)) {
            // execute animation sequently
            if (coroutines.length > 0) {
                if (coroutines[0].func(coroutines[0], deltaTime))
                    coroutines.splice(0, 1);
            }

            // Check if pointer is over 3D Model
            var node = this.getNodeUnderPointer(this.input.localPointerPosition());
            var nodeIDUnderPointer = node ? node.userData.id : -1;
            this.getBoundingSphereUnderPointer(this.input.localPointerPosition());

            // Check if pointer is over 2D Model in all view

            for (var i = 0; i < this.commonData.nodeIDUnderPointer.length; i++) {
                if (this.commonData.nodeIDUnderPointer[i] != -1) {
                    nodeIDUnderPointer = this.commonData.nodeIDUnderPointer[i];
                    break;
                }
            }

            // If the pointer is pointing to any node in 2D or 3D graph
            if (this.selectedNodeID !== nodeIDUnderPointer){
                if (nodeIDUnderPointer !== -1) {
                    // If we already have a node ID selected, deselect it
                    if (this.selectedNodeID >= 0) {
                        this.physioGraph.deselectNode(this.selectedNodeID);
                        this.colaGraph.deselectNode(this.selectedNodeID);
                    }

                    if (node) {
                        this.selectedNodeID = node.userData.id;
                    }
                    else {
                        this.selectedNodeID = nodeIDUnderPointer;
                    }

                    // Select the new node ID
                    this.physioGraph.selectNode(this.selectedNodeID, false, false);
                    this.colaGraph.selectNode(this.selectedNodeID, this.ignore3dControl, true);


                    var varNodeID = this.selectedNodeID;
                    if (this.networkType == "circular") {
                        var varMouseOveredCircularLayout = (d) => { this.circularGraph.mouseOveredCircularLayout(d); };
                        this.svgAllElements.selectAll(".nodeCircular")
                            .each(function (d) {
                                if (varNodeID == d.id) varMouseOveredCircularLayout(d);
                            });
                    }
                    else if (this.networkType == "2D") {
                        this.svgNeedsUpdate = true;
                    }
                } else {
                    if (this.selectedNodeID >= 0) {
                        this.physioGraph.deselectNode(this.selectedNodeID);
                        this.colaGraph.deselectNode(this.selectedNodeID);

                        var varNodeID = this.selectedNodeID;
                        if (this.networkType == "circular") {
                            var varMouseOutedCircularLayout = (d) => { this.circularGraph.mouseOutedCircularLayout(d); };
                            this.svgAllElements.selectAll(".nodeCircular")
                                .each(function (d) {
                                    if (varNodeID == d.id) varMouseOutedCircularLayout(d);
                                });
                        }
                        else if (this.networkType == "2D") {
                            this.svgNeedsUpdate = true;
                        }

                        this.selectedNodeID = -1;
                    }
                }
            }

            if (this.needUpdate || this.isAnimationOn) {
                this.physioGraph.update();
                this.colaGraph.update();
                this.needUpdate = false;
            }

            //if (this.showingCola)
            if (this.colaGraph.isVisible()) {
                //TODO: This is very slow, for minimal impact - look at using regular 3D layout, e.g.:
                //  http://marvl.infotech.monash.edu/webcola/examples/3dtree.html
                //  http://marvl.infotech.monash.edu/webcola/examples/3dlayout.js
                this.descent.rungeKutta(); // Do an iteration of the solver
            }
            this.scene.updateMatrixWorld();     //TODO: Confirm that this change has no side effects

            if (this.ignore3dControl && this.svgNeedsUpdate) {
                console.log("svgNeedsUpdate");///jm

                if (this.networkType == '2D') {
                    if (this.canvasGraph) {
                        this.canvasGraph.updateInteractive();
                    }
                }
                else if (this.networkType == 'circular') {
                    if (this.circularGraph) {
                        this.circularGraph.setColaGraph(this.physioGraph);
                        this.circularGraph.update();
                    }
                }

                this.svgNeedsUpdate = false;
            }
        }

        if (this.autoRotation) {
            var pixelAngleRatio = 50;

            var quatX = new THREE.Quaternion();
            var axisX = new THREE.Vector3(0, 1, 0);
            quatX.setFromAxisAngle(axisX, this.mouse.dx / pixelAngleRatio); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quatX, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quatX, this.colaObject.quaternion);

            var quatY = new THREE.Quaternion();
            var axisY = new THREE.Vector3(1, 0, 0);
            quatY.setFromAxisAngle(axisY, this.mouse.dy / pixelAngleRatio); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quatY, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quatY, this.colaObject.quaternion);
        }

        this.draw(); // Draw the graph
    }

    draw() {
        this.renderer.render(this.scene, this.camera);
    }
}



/* Functions can be pushed to the coroutines array to be executed as if they are
 * occuring in parallel with the program execution.
 */
var coroutines = new Array();

function setCoroutine(data, func) {
    data.func = func;
    coroutines.push(data);
}