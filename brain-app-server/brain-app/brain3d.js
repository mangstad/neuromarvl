/// <reference path="../extern/descent.ts"/>
/// <reference path="../extern/shortestpaths.ts"/>
/**
    This application uses similarity data between areas of the brain to construct a thresholded graph with edges
    between the most similar areas. It is designed to be embedded in a view defined in brainapp.html / brainapp.ts.
*/
var colans = cola;
var sliderSpace = 70; // The number of pixels to reserve at the bottom of the div for the slider
//var uniqueID = 0; // Each instance of this application is given a unique ID so that the DOM elements they create can be identified as belonging to them
var maxEdgesShowable = 1000;
var initialEdgesShown = 20; // The number of edges that are shown when the application starts
// The width and the height of the box in the xy-plane that we must keep inside the camera (by modifying the distance of the camera from the scene)
var widthInCamera = 520;
var heightInCamera = 360;
// TODO: Proper reset and destruction of the application (the 'instances' variable will continue to hold a reference - this will cause the application to live indefinitely)
/*
var instances = Array<Brain3DApp>(0); // Stores each instance of an application under its id, for lookup by the slider input element

function sliderChangeForID(id: number, v: number) {
    instances[id].sliderChange(v);
}
*/
var Brain3DApp = (function () {
    /*
    closeBrainAppCallback;

    regCloseBrainAppCallback(callback: (id: number) => void) {
        this.closeBrainAppCallback = callback;f
    }
    */
    function Brain3DApp(info, commonData, inputTargetCreator) {
        var _this = this;
        this.deleted = false;
        this.projector = new THREE.Projector();
        // Brain Surface
        this.surfaceUniformList = [];
        //Graphs
        this.circularGraph = null;
        this.colaGraph = null;
        this.svgGraph = null;
        this.physioGraph = null;
        this.needUpdate = false;
        this.isAnimationOn = false;
        this.svgControlMode = false;
        this.svgNeedsUpdate = false;
        this.d3Zoom = d3.behavior.zoom();
        this.dissimilarityMatrix = []; // An inversion of the similarity matrix, used for Cola graph distances
        // State
        this.showingTopologyNetwork = false;
        this.transitionInProgress = false;
        this.currentThreshold = 0;
        this.selectedNodeID = -1;
        this.edgeCountSliderValue = 0;
        this.surfaceLoaded = false;
        //CAMERA
        this.CAMERA_ZOOM_SPEED = 15;
        this.fovZoomRatio = 1;
        this.allLables = false;
        this.autoRotation = false;
        this.weightEdges = false;
        this.colorMode = "none";
        this.directionMode = "none";
        this.bundlingEdges = false;
        this.mouse = {
            dx: 0,
            dy: 0
        };
        // Constants
        this.nearClip = 1;
        this.farClip = 2000;
        this.modeLerpLength = 0.6;
        this.rotationSpeed = 1.2;
        this.graphOffset = 120;
        this.colaLinkDistance = 15;
        this.id = info.id;
        this.brainModelOrigin = info.brainModelOrigin;
        this.jDiv = info.jDiv;
        if (info.brainSurfaceMode) {
            this.brainSurfaceMode = info.brainSurfaceMode;
        }
        else {
            this.brainSurfaceMode = 0;
        }
        this.commonData = commonData;
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
        this.brainContainer.position = new THREE.Vector3(-this.graphOffset, 0, 0);
        this.brainContainer.lookAt(this.camera.position);
        this.scene.add(this.brainContainer);
        this.colaObject = new THREE.Object3D();
        this.colaObject.position = new THREE.Vector3(-this.graphOffset, 0, 0);
        this.scene.add(this.colaObject);
        // Register the data callbacks
        var coords = function () {
            _this.restart();
        };
        var lab = function () {
            _this.restart();
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
        this.circularGraph = new CircularGraph(this.id, this.jDiv, this.dataSet, this.svg, this.svgDefs, this.svgAllElements, this.d3Zoom, this.commonData);
    }
    Brain3DApp.prototype.setEdgeDirection = function (directionMode) {
        this.directionMode = directionMode;
        if (this.physioGraph)
            this.physioGraph.setEdgeDirection(directionMode);
        if (this.colaGraph)
            this.colaGraph.setEdgeDirection(directionMode);
        if (this.circularGraph)
            this.circularGraph.circularLayoutEdgeDirectionModeOnChange(directionMode);
        if (this.svgGraph)
            this.svgGraph.updateEdgeDirectionMode(directionMode);
        this.isAnimationOn = (directionMode === "animation");
        this.svgNeedsUpdate = true;
        if (dataSet.info.isSimatricalMatrix && directionMode !== "none") {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.WARNING, "The given similarity matrix is symmetrical," +
                "so the animation of edges do not reflect their actual direction.");
        }
    };
    Brain3DApp.prototype.setupUserInteraction = function (jDiv) {
        var _this = this;
        var varShowNetwork = function (b) { _this.showNetwork(b); };
        var varEdgesBundlingOnChange = function () { _this.edgesBundlingOnChange(); };
        var varAllLabelsOnChange = function () { _this.allLabelsOnChange(); };
        var varAutoRotationOnChange = function (s) { _this.autoRotationOnChange(s); };
        var varSliderMouseEvent = function (e) { _this.sliderMouseEvent(e); };
        var varGraphViewSliderOnChange = function (v) { _this.graphViewSliderOnChange(v); };
        var varEdgeCountSliderOnChange = function (v) { _this.edgeCountSliderOnChange(v); };
        var varCloseBrainAppOnClick = function () { _this.closeBrainAppOnClick(); };
        var varDefaultOrientationsOnClick = function (s) { _this.defaultOrientationsOnClick(s); };
        var varNetworkTypeOnChange = function (s) { _this.networkTypeOnChange(s); };
        var varBrainSurfaceModeOnChange = function () {
            if (_this.brainSurfaceMode === 0) {
                _this.brainSurfaceMode = 1;
                _this.setBrainMode(1);
                if (_this.dataSet) {
                    var newCoords = _this.computeMedialViewCoords();
                    _this.physioGraph.setNodePositions(newCoords);
                    _this.physioGraph.update();
                }
            }
            else {
                _this.brainSurfaceMode = 0;
                _this.setBrainMode(0);
                if (_this.dataSet) {
                    _this.physioGraph.setNodePositions(_this.dataSet.brainCoords);
                    _this.physioGraph.update();
                }
            }
        };
        var varShowProcessingNotification = function () { _this.showProcessingNotification(); };
        // Set the background color
        jDiv.css({ backgroundColor: '#ffffff' });
        // Set up renderer, and add the canvas and the slider to the div
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true
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
            .append($('<div id="div-svg-' + this.id + '"></div>')
            .css({ 'position': 'absolute', 'width': '100%', 'height': '100%', 'top': 0, 'left': 0, 'z-index': 10 }))
            .append(this.renderer.domElement)
            .append('<p>Showing <label id="count-' + this.id + '">0</label> edges (<label id=percentile-' + this.id + '>0</label>th percentile)</p>')
            .append($('<input id="edge-count-slider-' + this.id + '" type="range" min="1" max="' + maxEdgesShowable + '" value="' + initialEdgesShown + '" disabled="true"/>')
            .css({ 'display': 'inline-block', 'width': '300px', 'position': 'relative', 'margin-right': 10, 'z-index': 1000 })
            .mousedown(function () { varSliderMouseEvent("mousedown"); })
            .mouseup(function () { varSliderMouseEvent("mouseup"); })
            .on("input change", function () { varEdgeCountSliderOnChange($(this).val()); }))
            .append($('<button id="button-show-network-' + this.id + '">Show Network</button>').css({ 'margin-left': '10px', 'font-size': '12px', 'position': 'relative', 'z-index': 1000 })
            .click(function () { varShowNetwork(false); }))
            .append($('<select id="select-network-type-' + this.id + '" disabled="true"></select>').css({ 'margin-left': '5px', 'font-size': '12px', 'width': '80px', 'position': 'relative', 'z-index': 1000 })
            .on("change", function () { varNetworkTypeOnChange($(this).val()); }));
        $("[data-toggle='tooltip']").tooltip({ container: 'body' });
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
        // SVG Initializing
        var varSVGZoom = function () { _this.svgZoom(); };
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
        }
        catch (err) {
            console.log(err);
        }
    };
    Brain3DApp.prototype.setupInput = function () {
        var _this = this;
        // Register callbacks
        this.input.regKeyTickCallback('a', function (deltaTime) {
            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(0, -1, 0);
            quat.setFromAxisAngle(axis, _this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            _this.brainObject.quaternion.multiplyQuaternions(quat, _this.brainObject.quaternion);
            _this.colaObject.quaternion.multiplyQuaternions(quat, _this.colaObject.quaternion);
        });
        this.input.regKeyTickCallback('d', function (deltaTime) {
            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(0, 1, 0);
            quat.setFromAxisAngle(axis, _this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            _this.brainObject.quaternion.multiplyQuaternions(quat, _this.brainObject.quaternion);
            _this.colaObject.quaternion.multiplyQuaternions(quat, _this.colaObject.quaternion);
        });
        this.input.regKeyTickCallback('w', function (deltaTime) {
            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(-1, 0, 0);
            quat.setFromAxisAngle(axis, _this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            _this.brainObject.quaternion.multiplyQuaternions(quat, _this.brainObject.quaternion);
            _this.colaObject.quaternion.multiplyQuaternions(quat, _this.colaObject.quaternion);
        });
        this.input.regKeyTickCallback('s', function (deltaTime) {
            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(1, 0, 0);
            quat.setFromAxisAngle(axis, _this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            _this.brainObject.quaternion.multiplyQuaternions(quat, _this.brainObject.quaternion);
            _this.colaObject.quaternion.multiplyQuaternions(quat, _this.colaObject.quaternion);
        });
        var leapRotationSpeed = 0.03; // radians per mm
        this.input.regLeapXCallback(function (mm) {
            _this.brainObject.rotation.set(_this.brainObject.rotation.x, _this.brainObject.rotation.y, _this.brainObject.rotation.z + leapRotationSpeed * mm);
            _this.colaObject.rotation.set(_this.colaObject.rotation.x, _this.colaObject.rotation.y, _this.colaObject.rotation.z + leapRotationSpeed * mm);
        });
        this.input.regLeapYCallback(function (mm) {
            _this.brainObject.rotation.set(_this.brainObject.rotation.x - leapRotationSpeed * mm, _this.brainObject.rotation.y, _this.brainObject.rotation.z);
            _this.colaObject.rotation.set(_this.colaObject.rotation.x - leapRotationSpeed * mm, _this.colaObject.rotation.y, _this.colaObject.rotation.z);
        });
        this.input.regMouseDragCallback(function (dx, dy, mode) {
            if (_this.svgControlMode)
                return;
            // left button: rotation
            if (mode == 1) {
                if (_this.autoRotation == false) {
                    var pixelAngleRatio = 50;
                    var quatX = new THREE.Quaternion();
                    var axisX = new THREE.Vector3(0, 1, 0);
                    quatX.setFromAxisAngle(axisX, dx / pixelAngleRatio); // axis must be normalized, angle in radians
                    _this.brainObject.quaternion.multiplyQuaternions(quatX, _this.brainObject.quaternion);
                    _this.colaObject.quaternion.multiplyQuaternions(quatX, _this.colaObject.quaternion);
                    var quatY = new THREE.Quaternion();
                    var axisY = new THREE.Vector3(1, 0, 0);
                    quatY.setFromAxisAngle(axisY, dy / pixelAngleRatio); // axis must be normalized, angle in radians
                    _this.brainObject.quaternion.multiplyQuaternions(quatY, _this.brainObject.quaternion);
                    _this.colaObject.quaternion.multiplyQuaternions(quatY, _this.colaObject.quaternion);
                }
                else {
                    _this.mouse.dx = dx;
                    _this.mouse.dy = dy;
                }
            }
            else if (mode == 3) {
                var pixelDistanceRatio = 1.6; // with: defaultCameraFov = 25; defaultViewWidth = 800;
                var defaultCameraFov = 25;
                var defaultViewWidth = 800;
                // move brain model
                pixelDistanceRatio /= (_this.camera.fov / defaultCameraFov);
                pixelDistanceRatio *= (_this.currentViewWidth / defaultViewWidth);
                _this.brainContainer.position.set(_this.brainContainer.position.x + dx / pixelDistanceRatio, _this.brainContainer.position.y - dy / pixelDistanceRatio, _this.brainContainer.position.z);
                _this.colaObject.position.set(_this.colaObject.position.x + dx / pixelDistanceRatio, _this.colaObject.position.y - dy / pixelDistanceRatio, _this.colaObject.position.z);
                var prevQuaternion = _this.brainContainer.quaternion.clone();
                _this.brainContainer.lookAt(_this.camera.position);
            }
        });
        this.input.regMouseLeftClickCallback(function (x, y) {
            var oldSelectedNodeID = _this.commonData.selectedNode;
            _this.commonData.selectedNode = -1;
            // Check if pointer is over 3D Model
            var node = _this.getNodeUnderPointer(_this.input.localPointerPosition());
            _this.getBoundingSphereUnderPointer(_this.input.localPointerPosition());
            // Check if pointer is over 2D Model in all view
            var nodeIDUnderPointer = -1;
            for (var i = 0; i < _this.commonData.nodeIDUnderPointer.length; i++) {
                if (_this.commonData.nodeIDUnderPointer[i] != -1) {
                    nodeIDUnderPointer = _this.commonData.nodeIDUnderPointer[i];
                    break;
                }
            }
            if (oldSelectedNodeID != -1) {
                // Deselect the previous selected node
                _this.physioGraph.deselectNode(oldSelectedNodeID);
                _this.colaGraph.deselectNode(oldSelectedNodeID);
                var varNodeID = oldSelectedNodeID;
                if (_this.networkType == "circular") {
                    var varMouseOutedCircularLayout = function (d) { _this.circularGraph.mouseOutedCircularLayout(d); };
                    _this.svgAllElements.selectAll(".nodeCircular")
                        .each(function (d) {
                        if (varNodeID == d.id)
                            varMouseOutedCircularLayout(d);
                    });
                }
                else if (_this.networkType == "2D") {
                    _this.svgNeedsUpdate = true;
                }
            }
            // If the pointer is poiting to any node in 2D or 3D graph
            if (node || (nodeIDUnderPointer != -1)) {
                _this.commonData.selectedNode = (node) ? node.id : nodeIDUnderPointer;
                // Select the new node
                _this.physioGraph.selectNode(_this.commonData.selectedNode, false, false);
                _this.colaGraph.selectNode(_this.commonData.selectedNode, _this.svgMode, true);
                var varNodeID = _this.commonData.selectedNode;
                if (_this.networkType == "circular") {
                    var varMouseOveredCircularLayout = function (d) { _this.circularGraph.mouseOveredCircularLayout(d); };
                    _this.svgAllElements.selectAll(".nodeCircular")
                        .each(function (d) {
                        if (varNodeID == d.id)
                            varMouseOveredCircularLayout(d);
                    });
                }
                else if (_this.networkType == "2D") {
                    _this.svgNeedsUpdate = true;
                }
            }
        });
        this.input.regMouseRightClickCallback(function (x, y) {
            if (_this.svgControlMode)
                return;
            var record;
            var node = _this.getNodeUnderPointer(_this.input.localPointerPosition());
            if (node) {
                var color = node.material.color.getHex();
                record = _this.dataSet.getRecord(node.id);
                record["color"] = color;
            }
            return record;
        });
        /* Double Click the viewport will reset the Model*/
        this.input.regMouseDoubleClickCallback(function () {
            if (_this.svgControlMode)
                return;
            _this.fovZoomRatio = 1;
            _this.camera.fov = _this.defaultFov;
            _this.camera.updateProjectionMatrix();
            _this.brainContainer.position = new THREE.Vector3(-_this.graphOffset, 0, 0);
            _this.brainContainer.lookAt(_this.camera.position);
            _this.brainObject.rotation.set(0, 0, 0);
            //if (this.showingCola) {
            //if (this.colaGraph.isVisible()) {
            _this.colaObject.position = new THREE.Vector3(_this.graphOffset, 0, 0);
            _this.colaObject.rotation.set(0, 0, 0);
            //}   
        });
        /* Interact with mouse wheel will zoom in and out the 3D Model */
        this.input.regMouseWheelCallback(function (delta) {
            if (_this.svgControlMode)
                return; // 2D Flat Version of the network
            var pointer = _this.input.localPointerPosition();
            var pointerNDC = new THREE.Vector3(pointer.x, pointer.y, 1);
            _this.projector.unprojectVector(pointerNDC, _this.camera);
            var zoomVector = pointerNDC.sub(_this.camera.position).normalize().multiplyScalar(_this.CAMERA_ZOOM_SPEED);
            if (delta < 0) {
                _this.camera.position.add(zoomVector);
            }
            else {
                _this.camera.position.sub(zoomVector);
            }
        });
        this.input.regGetRotationCallback(function () {
            var rotation = [];
            rotation.push(_this.brainObject.rotation.x);
            rotation.push(_this.brainObject.rotation.y);
            rotation.push(_this.brainObject.rotation.z);
            return rotation;
        });
        this.input.regSetRotationCallback(function (rotation) {
            if ((rotation) && (rotation.length == 3)) {
                _this.brainObject.rotation.set(rotation[0], rotation[1], rotation[2]);
                _this.colaObject.rotation.set(rotation[0], rotation[1], rotation[2]);
            }
        });
    };
    Brain3DApp.prototype.setBrainMode = function (mode) {
        this.brainSurfaceMode = mode;
        var model = this.brainModelOrigin;
        this.surfaceUniformList = [];
        var uniformList = this.surfaceUniformList;
        var normalShader = {
            vertexShader: [
                "uniform float mode;",
                "varying vec3 vNormal;",
                "varying vec3 vPosition;",
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
        // Remove the old mesh and add the new one (we don't need a restart)
        this.brainObject.remove(this.brainSurface);
        var clonedObject = new THREE.Object3D();
        var boundingSphereObject = new THREE.Object3D();
        // Default mode: full brain model 
        if (mode == 0) {
            // Clone the mesh - we can't share it between different canvases without cloning it
            this.brainModelOrigin.traverse(function (child) {
                if (child instanceof THREE.Mesh) {
                    this.uniforms = {
                        opacity: { type: "f", value: 0.5 },
                        mode: { type: 'f', value: 0.0 }
                    };
                    uniformList.push(this.uniforms);
                    clonedObject.add(new THREE.Mesh(child.geometry.clone(), new THREE.ShaderMaterial({
                        uniforms: this.uniforms,
                        vertexShader: normalShader.vertexShader,
                        fragmentShader: normalShader.fragmentShader,
                        transparent: true
                    })));
                    clonedObject.renderDepth = 2;
                    child.geometry.computeBoundingSphere();
                    var boundingSphere = child.geometry.boundingSphere;
                    var material = child.material;
                    var sphereGeometry = new THREE.SphereGeometry(boundingSphere.radius + 10, 10, 10);
                    var sphereObject = new THREE.Mesh(sphereGeometry.clone(), material.clone());
                    sphereObject.position.x = boundingSphere.center.x;
                    sphereObject.position.y = boundingSphere.center.y;
                    sphereObject.position.z = boundingSphere.center.z;
                    sphereObject.visible = false;
                    sphereObject.isBoundingSphere = true;
                    boundingSphereObject.add(sphereObject);
                }
            });
        }
        else if (mode === 1) {
            // Clone the mesh - we can't share it between different canvases without cloning it
            this.brainModelOrigin.traverse(function (child) {
                if (child instanceof THREE.Mesh) {
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
                    var leftBrain = new THREE.Mesh(child.geometry.clone(), new THREE.ShaderMaterial({
                        uniforms: this.leftUniforms,
                        vertexShader: normalShader.vertexShader,
                        fragmentShader: normalShader.fragmentShader,
                        transparent: true
                    }));
                    leftBrain.renderDepth = 2;
                    var rightBrain = new THREE.Mesh(child.geometry.clone(), new THREE.ShaderMaterial({
                        uniforms: this.rightUniforms,
                        vertexShader: normalShader.vertexShader,
                        fragmentShader: normalShader.fragmentShader,
                        transparent: true
                    }));
                    rightBrain.renderDepth = 2;
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
                    var material = child.material;
                    var sphereGeometry = new THREE.SphereGeometry(boundingSphere.radius + 10, 10, 10);
                    var sphereObject = new THREE.Mesh(sphereGeometry.clone(), material.clone());
                    sphereObject.position.x = boundingSphere.center.x;
                    sphereObject.position.y = boundingSphere.center.y;
                    sphereObject.position.z = boundingSphere.center.z;
                    sphereObject.visible = false;
                    sphereObject.isBoundingSphere = true;
                    boundingSphereObject.add(sphereObject);
                }
            });
        }
        else {
            console.log("ERROR: Wrong Brain Surface Mode");
            return;
        }
        this.brainSurface = clonedObject;
        this.brainObject.add(this.brainSurface);
        boundingSphereObject.visible = false;
        this.brainSurfaceBoundingSphere = boundingSphereObject;
        this.brainObject.add(this.brainSurfaceBoundingSphere);
        this.surfaceLoaded = true;
        // update Physio Graph if exists
        if (!this.dataSet)
            return;
        if (this.brainSurfaceMode === 0) {
            this.filteredAdjMatrix = this.dataSet.adjMatrixFromEdgeCount(Number(this.edgeCountSliderValue));
        }
        else {
            this.filteredAdjMatrix = this.dataSet.adjMatrixWithoutEdgesCrossHemisphere(Number(this.edgeCountSliderValue));
        }
        this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    };
    Brain3DApp.prototype.setSurfaceOpacity = function (opacity) {
        for (var i = 0; i < this.surfaceUniformList.length; i++) {
            this.surfaceUniformList[i].opacity.value = opacity;
        }
    };
    Brain3DApp.prototype.getDrawingCanvas = function () {
        if (this.renderer)
            return this.renderer.domElement;
    };
    Brain3DApp.prototype.save = function (app) {
        app.edgeCount = this.edgeCountSliderValue;
        app.brainSurfaceMode = this.brainSurfaceMode;
        app.showingTopologyNetwork = this.showingTopologyNetwork;
        app.networkType = this.networkType;
        if (this.circularGraph) {
            app.circularBundleAttribute = this.circularGraph.circularBundleAttribute;
            app.circularSortAttribute = this.circularGraph.circularSortAttribute;
            app.circularLableAttribute = this.circularGraph.circularLableAttribute;
            app.circularAttributeBars = this.circularGraph.attributeBars;
        }
        else {
            console.log("ERROR: circularGraph is NULL");
        }
    };
    Brain3DApp.prototype.initEdgeCountSlider = function (app) {
        this.edgeCountSliderOnChange(app.edgeCount);
        $('#edge-count-slider-' + this.id).val(app.edgeCount);
    };
    Brain3DApp.prototype.initShowNetwork = function (app) {
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
                //this.circularGraph.attributeBars = app.circularAttributeBars;
                this.showNetwork(true);
            }
        }
    };
    Brain3DApp.prototype.sliderMouseEvent = function (e) {
        if (e == "mousedown") {
            this.input.sliderEvent = true;
        }
        else if (e == "mouseup") {
            this.input.sliderEvent = false;
        }
    };
    Brain3DApp.prototype.closeBrainAppOnClick = function () {
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
    };
    /* This function is linked with html codes and called when the new option is selected */
    Brain3DApp.prototype.networkTypeOnChange = function (type) {
        this.networkType = type;
        if (type === "circular" && this.circularGraph) {
            this.circularGraph.setupOptionMenuUI(); // add options button to the page
        }
        else {
            // hide options button
            $('#button-circular-layout-histogram-' + this.id).hide();
        }
        if (type === "2D" && this.svgGraph) {
            this.svgGraph.setupOptionMenuUI(); // add options button to the page
        }
        else {
            // hide options button
            $('#button-graph2d-option-menu-' + this.id).hide();
        }
        if (this.colaGraph.isVisible()) {
            this.showNetwork(true);
        }
        else {
            this.showNetwork(false);
        }
    };
    Brain3DApp.prototype.defaultOrientationsOnClick = function (orientation) {
        if (!orientation)
            return;
        switch (orientation) {
            case "top":
                this.brainObject.rotation.set(0, 0, 0);
                this.colaObject.rotation.set(0, 0, 0);
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
    };
    Brain3DApp.prototype.graphViewSliderOnChange = function (value) {
        this.colaGraph.setNodePositionsLerp(this.physioGraph.nodePositions, this.colaCoords, value / 100);
    };
    Brain3DApp.prototype.edgeCountSliderOnChange = function (numEdges) {
        this.edgeCountSliderValue = numEdges;
        var max = this.dataSet.sortedSimilarities.length;
        if (numEdges > max)
            numEdges = max;
        $('#count-' + this.id).get(0).textContent = numEdges;
        var percentile = numEdges * 100 / max;
        $('#percentile-' + this.id).get(0).textContent = percentile.toFixed(2);
        if (this.brainSurfaceMode === 0) {
            this.filteredAdjMatrix = this.dataSet.adjMatrixFromEdgeCount(numEdges);
        }
        else {
            this.filteredAdjMatrix = this.dataSet.adjMatrixWithoutEdgesCrossHemisphere(numEdges);
        }
        this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    };
    Brain3DApp.prototype.edgeThicknessByWeightOnChange = function (bool) {
        if ((!this.physioGraph) || (!this.colaGraph))
            return;
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
    };
    Brain3DApp.prototype.edgeColorOnChange = function (colorMode, config) {
        if ((!this.physioGraph) || (!this.colaGraph))
            return;
        this.colorMode = colorMode;
        this.physioGraph.setEdgeColorConfig(this.colorMode, config);
        this.colaGraph.setEdgeColorConfig(this.colorMode, config);
        if (this.circularGraph)
            this.circularGraph.circularLayoutEdgeColorModeOnChange(colorMode);
        if (this.svgGraph)
            this.svgGraph.updateEdgeColorMode(colorMode);
        this.svgNeedsUpdate = true;
        this.needUpdate = true;
    };
    Brain3DApp.prototype.edgesBundlingOnChange = function () {
        if ((!this.physioGraph) || (!this.colaGraph)) {
            this.removeProcessingNotification();
            return;
        }
        this.bundlingEdges = !this.bundlingEdges;
        if (this.bundlingEdges == true) {
            $('#bundling-edges-' + this.id).css('opacity', 1);
            //var powerGraphPhysio = new PowerGraph(this.physioGraph);
            //powerGraphPhysio.initPowerGraphSpatial3D();
            //powerGraph.initPowerGraph('3d', this.jDiv.width(), this.jDiv.height() - sliderSpace);
            if ((this.networkType == '3D')) {
            }
            else if (this.networkType == '2D') {
            }
        }
        else {
            $('#bundling-edges-' + this.id).css('opacity', 0.2);
            this.physioGraph.removeAllBundlingEdges();
            this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
            this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        }
        this.removeProcessingNotification();
    };
    Brain3DApp.prototype.showProcessingNotification = function () {
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
    };
    Brain3DApp.prototype.removeProcessingNotification = function () {
        if ($('#div-processing-notification').length > 0)
            document.body.removeChild(this.jDivProcessingNotification);
    };
    Brain3DApp.prototype.autoRotationOnChange = function (s) {
        this.autoRotation = !this.autoRotation;
        this.mouse.dx = 0;
        this.mouse.dy = 0;
        // set default rotation
        if (this.autoRotation == true) {
            $('#anti-auto-rotation-' + this.id).css('opacity', 1);
            if (s == "anticlockwise") {
                this.mouse.dx = 1;
                this.mouse.dy = 0;
            }
        }
        else {
            $('#anti-auto-rotation-' + this.id).css('opacity', 0.2);
        }
    };
    Brain3DApp.prototype.allLabelsOnChange = function () {
        if ((!this.physioGraph) || (!this.colaGraph))
            return;
        this.allLables = !this.allLables;
        this.physioGraph.allLabels = this.allLables;
        this.colaGraph.allLabels = this.allLables;
        if (this.allLables == true) {
            $('#all-labels-' + this.id).css('opacity', 1);
            this.physioGraph.showAllLabels(false, false);
            this.colaGraph.showAllLabels(this.svgMode, true);
        }
        else {
            $('#all-labels-' + this.id).css('opacity', 0.2);
            this.physioGraph.hideAllLabels();
            this.colaGraph.hideAllLabels();
        }
        this.svgNeedsUpdate = true;
    };
    Brain3DApp.prototype.showNetwork = function (switchNetworkType) {
        var _this = this;
        if (!this.brainObject || !this.colaObject || !this.physioGraph || !this.colaGraph)
            return;
        // Change the text of the button to "Topology"
        $('#button-show-network-' + this.id).text("Topology");
        this.showingTopologyNetwork = true;
        if (this.bundlingEdges)
            this.edgesBundlingOnChange(); // turn off edge bundling
        if (!this.transitionInProgress) {
            // Leave *showingCola* on permanently after first turn-on
            //this.showingCola = true;
            var edges = [];
            this.colaGraph.filteredNodeIDs = this.physioGraph.filteredNodeIDs;
            this.colaGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, edges);
            this.colaGraph.setNodeVisibilities(); // Hide the nodes without neighbours
            this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix); // Hide the edges that have not been selected
            if (this.allLables == true) {
                this.colaGraph.showAllLabels(this.svgMode, true);
            }
            //-------------------------------------------------------------------------------------------------------------
            // 3d cola graph
            var getSourceIndex = function (e) {
                return e.source;
            };
            var getTargetIndex = function (e) {
                return e.target;
            };
            var varType = this.networkType;
            var getLength = function (e) {
                return 1;
            };
            // Create the distance matrix that Cola needs
            var distanceMatrix = (new cola.shortestpaths.Calculator(this.dataSet.info.nodeCount, edges, getSourceIndex, getTargetIndex, getLength)).DistanceMatrix();
            var D = cola.Descent.createSquareMatrix(this.dataSet.info.nodeCount, function (i, j) {
                return distanceMatrix[i][j] * _this.colaLinkDistance;
            });
            var clonedPhysioCoords = this.dataSet.brainCoords.map(function (dim) {
                return dim.map(function (element) {
                    return element;
                });
            });
            this.descent = new cola.Descent(clonedPhysioCoords, D); // Create the solver
            var originColaCoords;
            if (switchNetworkType == true) {
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
            if (this.svgMode) {
                // clear svg 
                this.svgGraph.clear();
                // clear  circular
                this.circularGraph.clear();
                this.svgMode = false;
            }
            //-------------------------------------------------------------------------------------------------------------
            // animation
            if (this.networkType == '2D') {
                // Redraw 3D cola graph
                if (this.edgeCountSliderValue < 500) {
                    if (!switchNetworkType) {
                        // Set up a coroutine to do the animation
                        var origin = new THREE.Vector3(this.brainContainer.position.x, this.brainContainer.position.y, this.brainContainer.position.z);
                        var target = new THREE.Vector3(this.brainContainer.position.x + 2 * this.graphOffset, this.brainContainer.position.y, this.brainContainer.position.z);
                        this.colaObjectAnimation(origin, target, originColaCoords, this.colaCoords, switchNetworkType, false);
                    }
                    // Animating process converting from 3D graph to 2Dg
                    this.threeToSVGAnimation(true);
                }
                else {
                    this.colaGraph.setVisible(true);
                    this.colaGraph.setNodePositions(this.colaCoords);
                    this.colaGraph.setVisible(false);
                    this.svgGraph.initSVGGraphWithoutCola(this.colaGraph);
                    this.svgMode = true;
                }
            }
            else if (this.networkType == 'circular') {
                this.svgMode = true;
                this.svgNeedsUpdate = true;
                this.colaGraph.setVisible(false); // turn off 3D and 2D graph
                if ($('#select-circular-layout-bundle-' + this.id).length <= 0)
                    return;
                if ($('#select-circular-layout-sort-' + this.id).length <= 0)
                    return;
                // Update Cola Graph used in Circular Graph and then recreate it
                // update share data
                this.circularGraph.circularEdgeColorMode = this.colorMode;
                this.circularGraph.circularEdgeDirectionMode = this.directionMode;
                this.circularGraph.setColaGraph(this.physioGraph);
                this.circularGraph.create();
            }
            else {
                // Set up a coroutine to do the animation
                var origin = new THREE.Vector3(this.brainContainer.position.x, this.brainContainer.position.y, this.brainContainer.position.z);
                var target = new THREE.Vector3(this.brainContainer.position.x + 2 * this.graphOffset, this.brainContainer.position.y, this.brainContainer.position.z);
                this.colaObjectAnimation(origin, target, originColaCoords, this.colaCoords, switchNetworkType, true);
            }
        }
    };
    Brain3DApp.prototype.cross = function (u, v) {
        if (!u || !v)
            return;
        var u1 = u[0];
        var u2 = u[1];
        var u3 = u[2];
        var v1 = v[0];
        var v2 = v[1];
        var v3 = v[2];
        var cross = [u2 * v3 - u3 * v2, u3 * v1 - u1 * v3, u1 * v2 - u2 * v1];
        return cross;
    };
    Brain3DApp.prototype.angle = function (u, v) {
        if (!u || !v)
            return;
        var costheta = numeric.dot(u, v) / (numeric.norm2(u) * numeric.norm2(v));
        var theta = Math.acos(costheta);
        return theta;
    };
    Brain3DApp.prototype.threeToSVGAnimation = function (transitionFinish) {
        this.svgGraph.initSVGGraph(this.colaGraph, this.camera);
        this.colaGraph.setVisible(false);
        this.svgMode = true;
        this.svgNeedsUpdate = true;
        this.transitionInProgress = false;
        // Enable the vertical slider
        $('#graph-view-slider-' + this.id).css({ visibility: 'visible' });
        $('#graph-view-slider-' + this.id).val('100');
        $('#button-show-network-' + this.id).prop('disabled', false);
        $('#select-network-type-' + this.id).prop('disabled', false);
        $('#graph-view-slider-' + this.id).prop('disabled', false);
    };
    Brain3DApp.prototype.colaObjectAnimation = function (colaObjectOrigin, colaObjectTarget, nodeCoordOrigin, nodeCoordTarget, switchNetworkType, transitionFinish) {
        var _this = this;
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
        if (switchNetworkType == true) {
            this.colaObject.position = colaObjectTarget;
        }
        else {
            this.colaObject.position = colaObjectOrigin;
        }
        setCoroutine({ currentTime: 0, endTime: this.modeLerpLength }, function (o, deltaTime) {
            o.currentTime += deltaTime;
            if (o.currentTime >= o.endTime) {
                _this.colaObject.position = colaObjectTarget;
                _this.colaGraph.setNodePositions(nodeCoordTarget);
                if (transitionFinish) {
                    _this.transitionInProgress = false;
                    _this.needUpdate = true;
                    // Enable the vertical slider
                    $('#graph-view-slider-' + _this.id).css({ visibility: 'visible' });
                    $('#graph-view-slider-' + _this.id).val('100');
                    $('#button-show-network-' + _this.id).prop('disabled', false);
                    $('#select-network-type-' + _this.id).prop('disabled', false);
                    $('#graph-view-slider-' + _this.id).prop('disabled', false);
                }
                return true;
            }
            else {
                var percentDone = o.currentTime / o.endTime;
                _this.needUpdate = true;
                _this.colaGraph.setNodePositionsLerp(nodeCoordOrigin, nodeCoordTarget, percentDone);
                if (switchNetworkType == false) {
                    _this.colaObject.position = colaObjectOrigin.clone().add(colaObjectTarget.clone().sub(colaObjectOrigin).multiplyScalar(percentDone));
                }
                return false;
            }
        });
    };
    Brain3DApp.prototype.svgZoom = function () {
        if (this.svgControlMode) {
            this.svgAllElements.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
            if (this.networkType == "2D")
                this.svgNeedsUpdate = true;
        }
    };
    Brain3DApp.prototype.mouseOveredSetNodeID = function (id) {
        this.commonData.nodeIDUnderPointer[4] = id;
    };
    Brain3DApp.prototype.mouseOutedSetNodeID = function () {
        this.commonData.nodeIDUnderPointer[4] = -1;
    };
    Brain3DApp.prototype.createSVGLinearGradient = function (id, stops) {
        var svgNS = this.svg.namespaceURI;
        var grad = document.createElementNS(svgNS, 'linearGradient');
        grad.setAttribute('id', id);
        for (var i = 0; i < stops.length; i++) {
            var attrs = stops[i];
            var stop = document.createElementNS(svgNS, 'stop');
            for (var attr in attrs) {
                if (attrs.hasOwnProperty(attr))
                    stop.setAttribute(attr, attrs[attr]);
            }
            grad.appendChild(stop);
        }
        this.svgDefs.appendChild(grad);
    };
    Brain3DApp.prototype.createMarker = function () {
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
    };
    Brain3DApp.prototype.update2DGraph = function () {
        if (this.networkType == '2D') {
            if (this.svgGraph) {
                this.svgGraph.update(this.colaGraph, this.allLables);
            }
        }
        else if (this.networkType == 'circular') {
            if (this.circularGraph) {
                this.circularGraph.setColaGraph(this.physioGraph);
                this.circularGraph.update();
            }
        }
    };
    Brain3DApp.prototype.isDeleted = function () {
        return this.deleted;
    };
    Brain3DApp.prototype.applyFilter = function (filteredIDs) {
        if (!this.dataSet || !this.dataSet.attributes)
            return;
        if (this.bundlingEdges)
            this.edgesBundlingOnChange(); // turn off edge bundling
        this.physioGraph.filteredNodeIDs = filteredIDs;
        this.physioGraph.applyNodeFiltering();
        this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    };
    //////////////////////////////////////////////////
    /// Node Attributes //////////////////////////////
    //////////////////////////////////////////////////
    Brain3DApp.prototype.highlightSelectedNodes = function (filteredIDs) {
        if (!this.dataSet || !this.dataSet.attributes)
            return;
        this.physioGraph.highlightSelectedNodes(filteredIDs);
        this.colaGraph.highlightSelectedNodes(filteredIDs);
        this.svgNeedsUpdate = true;
    };
    Brain3DApp.prototype.setNodeDefaultSizeColor = function () {
        // set default node color and scale
        this.physioGraph.setDefaultNodeColor();
        this.colaGraph.setDefaultNodeColor();
        this.physioGraph.setDefaultNodeScale();
        this.colaGraph.setDefaultNodeScale();
        this.svgNeedsUpdate = true;
    };
    Brain3DApp.prototype.setNodeSize = function (scaleArray) {
        this.physioGraph.setNodesScale(scaleArray);
        this.colaGraph.setNodesScale(scaleArray);
        this.svgNeedsUpdate = true;
    };
    Brain3DApp.prototype.setANodeColor = function (nodeID, color) {
        var value = parseInt(color.replace("#", "0x"));
        this.physioGraph.setNodeColor(nodeID, value);
        this.colaGraph.setNodeColor(nodeID, value);
        this.svgNeedsUpdate = true;
    };
    Brain3DApp.prototype.setNodeColor = function (attribute, minColor, maxColor) {
        if (!attribute || !minColor || !maxColor) {
            throw "Invalid arguments for setNodeColor.";
        }
        if (!this.dataSet || !this.dataSet.attributes) {
            alert("Dataset is not loaded or does not contain attributes.");
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
        var colorArray;
        if (attrArray[0].length > 1) {
            var colorMap = d3.scale.linear().domain([Math.log(min), Math.log(max)]).range([minColor, maxColor]);
            colorArray = attrArray.map(function (value) {
                var str = colorMap(value.indexOf(Math.max.apply(Math, value))).replace("#", "0x");
                return parseInt(str);
            });
        }
        else {
            var colorMap = d3.scale.linear().domain([min, max]).range([minColor, maxColor]);
            colorArray = attrArray.map(function (value) {
                var str = colorMap(Math.max.apply(Math, value)).replace("#", "0x");
                return parseInt(str);
            });
        }
        if (!colorArray) {
            throw "Encountered error in generating color array.";
        }
        // update graphs
        if (this.physioGraph)
            this.physioGraph.setNodesColor(colorArray);
        if (this.colaGraph)
            this.colaGraph.setNodesColor(colorArray);
        if (this.svgGraph)
            this.svgGraph.isEdgeColorChanged = true;
        this.svgNeedsUpdate = true; // update to change node color
    };
    Brain3DApp.prototype.setNodeColorDiscrete = function (attribute, keyArray, colorArray) {
        if (!attribute)
            return;
        if (!this.dataSet || !this.dataSet.attributes)
            return;
        var attrArray = this.dataSet.attributes.get(attribute);
        if (!attrArray)
            return;
        var colorArrayNum;
        var colorMap = d3.scale.ordinal().domain(keyArray).range(colorArray);
        if (attrArray[0].length > 1) {
            colorArrayNum = attrArray.map(function (value) {
                //var str = colorMap(value.indexOf(Math.max.apply(Math, value))).replace("#", "0x");
                //return parseInt(str);
                var color = 0;
                var counter = 0;
                value.forEach(function (v, i) {
                    if (v > 0) {
                        color += parseInt(colorMap(i).replace("#", "0x"));
                        counter++;
                    }
                });
                return Math.round(color / counter);
            });
        }
        else {
            colorArrayNum = attrArray.map(function (value) {
                var str = colorMap(Math.max.apply(Math, value)).replace("#", "0x");
                return parseInt(str);
            });
        }
        if (!colorArrayNum)
            return;
        this.physioGraph.setNodesColor(colorArrayNum);
        this.colaGraph.setNodesColor(colorArrayNum);
        if (this.svgGraph)
            this.svgGraph.isEdgeColorChanged = true;
        this.svgNeedsUpdate = true;
    };
    //////////////////////////////////////////////////
    /// Edge Attributes //////////////////////////////
    //////////////////////////////////////////////////
    Brain3DApp.prototype.getCurrentEdgeWeightRange = function () {
        var range = {
            min: this.physioGraph.edgeMinWeight,
            max: this.physioGraph.edgeMaxWeight
        };
        return range;
    };
    Brain3DApp.prototype.setEdgeSize = function (size) {
        this.physioGraph.setEdgeScale(size);
        this.colaGraph.setEdgeScale(size);
        this.svgNeedsUpdate = true;
        this.needUpdate = true;
    };
    Brain3DApp.prototype.setEdgeThicknessByWeight = function (bool) {
        this.edgeThicknessByWeightOnChange(bool);
        this.needUpdate = true;
    };
    Brain3DApp.prototype.setEdgeColorByWeight = function (config) {
        var colorMode = "weight";
        this.edgeColorOnChange(colorMode, config);
        this.needUpdate = true;
    };
    Brain3DApp.prototype.setEdgeColorByNode = function () {
        var colorMode = "node";
        this.edgeColorOnChange(colorMode);
        this.needUpdate = true;
    };
    Brain3DApp.prototype.setEdgeNoColor = function () {
        var colorMode = "none";
        this.edgeColorOnChange(colorMode);
        this.needUpdate = true;
    };
    Brain3DApp.prototype.setEdgeDirectionGradient = function () {
        if (this.physioGraph)
            this.physioGraph.setEdgeDirectionGradient();
        if (this.colaGraph)
            this.colaGraph.setEdgeDirectionGradient();
        if (this.circularGraph)
            this.circularGraph.update();
        if (this.svgGraph)
            this.svgGraph.isEdgeColorChanged;
        if (this.svgGraph)
            this.svgGraph.updateEdgeColor();
        this.needUpdate = true;
    };
    /* Called when the size of the view port is changed*/
    Brain3DApp.prototype.resize = function (width, height) {
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
    };
    Brain3DApp.prototype.setDataSet = function (dataSet) {
        var _this = this;
        this.dataSet = dataSet;
        // Update slider max value
        if (this.dataSet.sortedSimilarities.length < maxEdgesShowable) {
            $("#edge-count-slider-" + this.id).prop("max", this.dataSet.sortedSimilarities.length);
        }
        else {
            $("#edge-count-slider-" + this.id).prop("max", maxEdgesShowable);
        }
        // update Circular Dataset
        this.circularGraph.setDataSet(dataSet);
        var sim = function () {
            _this.restart();
        };
        var att = function () {
            _this.restart(); // TODO: We're currently destroying the entire graph to switch out the node group information - we can do better than that
        };
        dataSet.regNotifySim(sim);
        dataSet.regNotifyAttributes(att);
        if (dataSet.simMatrix && dataSet.attributes) {
            this.restart();
        }
        else {
            console.log("Warning: Similarity Matrix and Attributes not Available.");
        }
        this.physioGraph.update();
        // this.colaGraph.update();
    };
    // Initialize or re-initialize the visualisation.
    Brain3DApp.prototype.restart = function () {
        if (!this.dataSet || !this.dataSet.verify())
            return;
        console.log("restarted");
        // Create the dissimilarity matrix from the similarity matrix (we need dissimilarity for Cola)
        for (var i = 0; i < this.dataSet.simMatrix.length; ++i) {
            this.dissimilarityMatrix.push(this.dataSet.simMatrix[i].map(function (sim) {
                //return 15 / (sim + 1); // Convert similarities to distances
                return 0.5 / (sim * sim);
            }));
        }
        // Set up the node colorings
        this.nodeColorings = this.dataSet.attributes.attrValues[0].map(function (group) {
            return 0xd3d3d3;
        });
        // Set up loop
        // Set up the two graphs
        var edgeMatrix = this.dataSet.adjMatrixFromEdgeCount(maxEdgesShowable); // Don''t create more edges than we will ever be showing
        if (this.physioGraph)
            this.physioGraph.destroy();
        this.physioGraph = new Graph(this.brainObject, edgeMatrix, this.nodeColorings, this.dataSet.simMatrix, this.dataSet.brainLabels, this.commonData);
        if (this.brainSurfaceMode === 0) {
            this.physioGraph.setNodePositions(this.dataSet.brainCoords);
        }
        else if (this.brainSurfaceMode === 1) {
            var newCoords = this.computeMedialViewCoords();
            this.physioGraph.setNodePositions(newCoords);
        }
        else {
            console.log("ERROR: Wrong Brain Surface Mode");
        }
        var edgeMatrix = this.dataSet.adjMatrixFromEdgeCount(maxEdgesShowable);
        if (this.colaGraph)
            this.colaGraph.destroy();
        this.colaGraph = new Graph(this.colaObject, edgeMatrix, this.nodeColorings, this.dataSet.simMatrix, this.dataSet.brainLabels, this.commonData);
        this.colaGraph.setVisible(false);
        this.svgGraph = new Graph2D(this.id, this.jDiv, this.dataSet, this.svg, this.svgDefs, this.svgAllElements, this.d3Zoom, this.commonData);
        // Initialize the filtering
        if (this.brainSurfaceMode === 0) {
            this.filteredAdjMatrix = this.dataSet.adjMatrixFromEdgeCount(Number(this.edgeCountSliderValue));
        }
        else {
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
    };
    Brain3DApp.prototype.computeMedialViewCoords = function () {
        var newCoords = [[], [], []];
        var zAxis = new THREE.Vector3(0, 0, 1);
        var box = new THREE.Box3()['setFromObject'](this.brainModelOrigin);
        var mean = (box.max.z - box.min.z) / 2;
        var offsetToHead = box.max.z - mean;
        for (var i = 0; i < this.dataSet.brainCoords[0].length; i++) {
            var coord = new THREE.Vector3(this.dataSet.brainCoords[0][i], this.dataSet.brainCoords[1][i], this.dataSet.brainCoords[2][i]);
            if (coord.x < 0) {
                coord.applyAxisAngle(zAxis, Math.PI / 2);
                coord.x = coord.x - offsetToHead;
                coord.z = coord.z - box.max.z;
            }
            else {
                coord.applyAxisAngle(zAxis, -Math.PI / 2);
                coord.x = coord.x + offsetToHead;
                coord.z = coord.z + Math.abs(box.min.z);
            }
            newCoords[0].push(coord.x);
            newCoords[1].push(coord.y);
            newCoords[2].push(coord.z);
        }
        return newCoords;
    };
    Brain3DApp.prototype.getNodeUnderPointer = function (pointer) {
        var pointerNDC = new THREE.Vector3(pointer.x, pointer.y, 1);
        this.projector.unprojectVector(pointerNDC, this.camera);
        var directionVector = pointerNDC.sub(this.camera.position);
        directionVector.normalize();
        var raycaster = new THREE.Raycaster(this.camera.position, directionVector, this.nearClip, this.farClip);
        var intersected = raycaster.intersectObjects(this.scene.children, true);
        for (var i = 0; i < intersected.length; ++i) {
            if (intersected[i].object.isNode) {
                this.commonData.nodeIDUnderPointer[this.id] = intersected[i].object.id;
                return intersected[i].object;
            }
        }
        this.commonData.nodeIDUnderPointer[this.id] = -1;
        return null;
    };
    Brain3DApp.prototype.getBoundingSphereUnderPointer = function (pointer) {
        var _this = this;
        var pointerNDC = new THREE.Vector3(pointer.x, pointer.y, 1);
        this.projector.unprojectVector(pointerNDC, this.camera);
        var directionVector = pointerNDC.sub(this.camera.position);
        directionVector.normalize();
        var raycaster = new THREE.Raycaster(this.camera.position, directionVector, this.nearClip, this.farClip);
        var intersected = raycaster.intersectObjects(this.scene.children, true);
        var inBoundingSphere = false;
        for (var i = 0; i < intersected.length; ++i) {
            if (intersected[i].object.isBoundingSphere) {
                inBoundingSphere = true;
                break;
            }
        }
        if ((this.networkType == '2D') || (this.networkType == 'circular')) {
            if (inBoundingSphere == true) {
                this.svgControlMode = false;
                this.svg.on(".zoom", null);
            }
            else {
                this.svgControlMode = true;
                var varSVGZoom = function () { _this.svgZoom(); };
                this.svg.call(this.d3Zoom.on("zoom", varSVGZoom));
            }
        }
        else {
            this.svgControlMode = false;
            this.svg.on(".zoom", null);
        }
    };
    Brain3DApp.prototype.update = function (deltaTime) {
        var _this = this;
        // Execute coroutines
        if ((this.physioGraph) && (this.colaGraph)) {
            // execute animation sequently
            if (coroutines.length > 0) {
                if (coroutines[0].func(coroutines[0], deltaTime))
                    coroutines.splice(0, 1);
            }
            // Check if pointer is over 3D Model
            var node = this.getNodeUnderPointer(this.input.localPointerPosition());
            var nodeIDUnderPointer = (node) ? node.id : -1;
            this.getBoundingSphereUnderPointer(this.input.localPointerPosition());
            // Check if pointer is over 2D Model in all view
            for (var i = 0; i < this.commonData.nodeIDUnderPointer.length; i++) {
                if (this.commonData.nodeIDUnderPointer[i] != -1) {
                    nodeIDUnderPointer = this.commonData.nodeIDUnderPointer[i];
                    break;
                }
            }
            // If the pointer is poiting to any node in 2D or 3D graph
            if (this.selectedNodeID !== nodeIDUnderPointer) {
                if (nodeIDUnderPointer !== -1) {
                    // If we already have a node ID selected, deselect it
                    if (this.selectedNodeID >= 0) {
                        this.physioGraph.deselectNode(this.selectedNodeID);
                        this.colaGraph.deselectNode(this.selectedNodeID);
                    }
                    if (node) {
                        this.selectedNodeID = node.id;
                    }
                    else {
                        this.selectedNodeID = nodeIDUnderPointer;
                    }
                    // Select the new node ID
                    this.physioGraph.selectNode(this.selectedNodeID, false, false);
                    this.colaGraph.selectNode(this.selectedNodeID, this.svgMode, true);
                    var varNodeID = this.selectedNodeID;
                    if (this.networkType == "circular") {
                        var varMouseOveredCircularLayout = function (d) { _this.circularGraph.mouseOveredCircularLayout(d); };
                        this.svgAllElements.selectAll(".nodeCircular")
                            .each(function (d) {
                            if (varNodeID == d.id)
                                varMouseOveredCircularLayout(d);
                        });
                    }
                    else if (this.networkType == "2D") {
                        this.svgNeedsUpdate = true;
                    }
                }
                else {
                    if (this.selectedNodeID >= 0) {
                        this.physioGraph.deselectNode(this.selectedNodeID);
                        this.colaGraph.deselectNode(this.selectedNodeID);
                        var varNodeID = this.selectedNodeID;
                        if (this.networkType == "circular") {
                            var varMouseOutedCircularLayout = function (d) { _this.circularGraph.mouseOutedCircularLayout(d); };
                            this.svgAllElements.selectAll(".nodeCircular")
                                .each(function (d) {
                                if (varNodeID == d.id)
                                    varMouseOutedCircularLayout(d);
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
                this.descent.rungeKutta(); // Do an iteration of the solver
            }
            this.scene.updateMatrixWorld(true);
            this.scene.updateMatrixWorld(true);
            if (this.svgMode && this.svgNeedsUpdate) {
                this.update2DGraph();
                this.svgNeedsUpdate = false;
            }
        }
        if (this.autoRotation) {
            //this.brainObject.rotation.set(this.brainObject.rotation.x + this.mouse.dy / 100, this.brainObject.rotation.y + this.mouse.dx / 100, this.brainObject.rotation.z);
            //this.colaObject.rotation.set(this.colaObject.rotation.x + this.mouse.dy / 100, this.colaObject.rotation.y + this.mouse.dx / 100, this.colaObject.rotation.z);
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
    };
    Brain3DApp.prototype.draw = function () {
        this.renderer.render(this.scene, this.camera);
    };
    return Brain3DApp;
}());
/* Functions can be pushed to the coroutines array to be executed as if they are
 * occuring in parallel with the program execution.
 */
var coroutines = new Array();
function setCoroutine(data, func) {
    data.func = func;
    coroutines.push(data);
}
