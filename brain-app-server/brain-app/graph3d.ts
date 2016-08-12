
const RENDER_ORDER_EDGE = 0.1;

class Graph3D {
    parentObject;
    rootObject;
    commonData;
    saveObj;

    // Nodes
    nodeMeshes: any[];
    nodePositions: number[][];
    nodeInfo: any[];
    //nodeDefaultColor: number[];
    nodeCurrentColor: number[];

    // Edges
    edgeColorConfig;
    edgeDirectionMode: string; // none, opacity, arrow, and animation
    edgeMinColor: string;
    edgeMaxColor: string;
    edgeMaxWeight: number = Number.MIN_VALUE;
    edgeMinWeight: number = Number.MAX_VALUE;
    edgeMatrix: any[][];
    edgeList: Edge[] = [];
    edgeThicknessByWeight: boolean = false;
    colorMode: string = "none";     // weight, node, none
    bundlingEdgeList: any[] = [];
    visible: boolean = true;


    filteredNodeIDs: number[];
    nodeHasNeighbors: boolean[]; // used for cola graph only

    // Shared for optimisation
    _sphereGeometry: THREE.SphereGeometry = new THREE.SphereGeometry(2, 10, 10);

    allLabels: boolean = false;
    
    constructor(parentObject, adjMatrix: any[][], nodeColorings: { color: number, portion: number }[][], weightMatrix: any[][], labels: string[], commonData, saveObj) {
        this.parentObject = parentObject;
        this.rootObject = new THREE.Object3D();
        this.commonData = commonData;
        this.saveObj = saveObj;
        this.edgeDirectionMode = "none";
        parentObject.add(this.rootObject);

        // Create all the node meshes
        this.nodeMeshes = Array(adjMatrix.length);
        this.nodeInfo = Array.apply(null, Array(adjMatrix.length)).map(function (x, i) {
            return {
                isSelected: false
            };
        })
        
        //this.nodeDefaultColor = nodeColorings.map(a => this.averageColor(a)); // Use average colour
        //this.nodeCurrentColor = this.nodeDefaultColor.slice(0); // clone the array
        this.nodeCurrentColor = nodeColorings.map(a => this.averageColor(a)); // Use average colour for base, used generally and when restoring from highlights

        for (var i = 0; i < adjMatrix.length; ++i) {
            //TODO: Originally using spheres, but can switch to sprites for pie chart representations
            var nodeObject = this.nodeMeshes[i] = new THREE.Mesh(
                this._sphereGeometry,
                new THREE.MeshLambertMaterial({
                    //color: this.nodeDefaultColor[i],       // Average colour value needed for material
                    color: this.nodeCurrentColor[i],
                    transparent: true       // Not actually transparent, but need this or three.js will render it before the brain surface
                })
            );
            nodeObject.renderOrder = RENDER_ORDER_EDGE; // Draw at the same level as edges
            
            var label = (!!labels && labels[i]) || "";
            this.nodeInfo[i]["label"] = this.createNodeLabel(label, 6);

            // User data, which will be useful for other graphs using this graph as a basis
            nodeObject.userData.hasVisibleEdges = true;
            nodeObject.userData.id = i;
            nodeObject.userData.colors = nodeColorings[i];
            nodeObject.userData.filtered = false;

            this.rootObject.add(nodeObject);
        }

        // Create all the edges
        var len = adjMatrix.length;
        for (var i = 0; i < len - 1; ++i) {
            adjMatrix[i][i] = null;
            for (var j = i + 1; j < len; ++j) {

                if (adjMatrix[i][j] === 1 || adjMatrix[j][i] === 1) {

                    if (this.edgeMinWeight > weightMatrix[i][j]) {
                        this.edgeMinWeight = weightMatrix[i][j];
                    } else if (this.edgeMinWeight > weightMatrix[j][i]) {
                        this.edgeMinWeight = weightMatrix[j][i];
                    }
                    if (this.edgeMaxWeight < weightMatrix[i][j]) {
                        this.edgeMaxWeight = weightMatrix[i][j];
                    } else if (this.edgeMaxWeight < weightMatrix[j][i]) {
                        this.edgeMaxWeight = weightMatrix[j][i];
                    }

                    if (weightMatrix[i][j] > weightMatrix[j][i]) {
                        this.edgeList.push(adjMatrix[i][j] = new Edge(this, this.nodeMeshes[i], this.nodeMeshes[j], weightMatrix[i][j])); // assume symmetric matrix
                        adjMatrix[j][i] = null;
                    } else {
                        this.edgeList.push(adjMatrix[j][i] = new Edge(this, this.nodeMeshes[j], this.nodeMeshes[i], weightMatrix[j][i])); // assume symmetric matrix
                        adjMatrix[i][j] = null;
                    }
                } else {
                    adjMatrix[i][j] = null;
                    adjMatrix[j][i] = null;
                }

            }
        }
        
        if (len > 0) adjMatrix[len - 1][len - 1] = null;

        this.edgeMatrix = adjMatrix;
    }

    
    averageColor = (colors: { color: number, portion: number }[]) => {
        return colors.reduce((acc, color) => {
            let threeColor = new THREE.Color(color.color);
            return acc.add(threeColor.multiplyScalar(color.portion));
        }, new THREE.Color(0, 0, 0)).getHex();
    }


    generateSprite(nodeColouring: number) {
        // TODO: This isn't currently being used, but could be useful if using sprites for nodes, so multimodule pies are possible
        var canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        var context = canvas.getContext('2d');
        var gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.4, 'rgba(64,64,64,0.6)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        var texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        var material = new THREE.SpriteMaterial({
            map: texture
        });
        var sprite = new THREE.Sprite(material);

		return sprite;
    }


    //////////////////////////////////////////////
    /////// Node's Functions /////////////////////
    //////////////////////////////////////////////
    createNodeLabel(text: string, fontSize: number) {
        // draw text on canvas 
        var multiplyScale = 3; // for higher resolution of the label
        var varFontSize = fontSize * multiplyScale;

        // 1. create a canvas element
        var canvas = document.createElement('canvas');

        var context = canvas.getContext('2d');
        context.font = "Bold " + varFontSize + "px Arial";
        
        // Canvas dimensions expected to be a power of 2
        canvas.width = this.nextPowerOf2(context.measureText(text).width);
        canvas.height = this.nextPowerOf2(varFontSize);

        context.font = varFontSize + "px Arial";
        context.fillStyle = "rgba(0,0,0,1)";
        context.fillText(text, 0, varFontSize);

        // 2. canvas contents will be used for a texture
        var texture = new THREE.Texture(canvas)
	    texture.needsUpdate = true;

        // 3. map texture to an object
        var spriteMaterial = new THREE.SpriteMaterial(<any>{
            map: texture,
            depthTest: false
        });
        var sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(canvas.width / multiplyScale, canvas.height / multiplyScale, 1);

        return sprite;
    }

    nextPowerOf2(n: number) {
        var i = 0;
        var s = 0;
        while (s < n) {
            i++;
            s = Math.pow(2, i);
        }
        return s;
    }

    setNodePositions(colaCoords: number[][]) {
        this.nodePositions = colaCoords;
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            var x, y, z;
            x = colaCoords[0][i];
            y = colaCoords[1][i];
            z = colaCoords[2][i];
            this.nodeMeshes[i].position.set(x, y, z);
            this.nodeInfo[i]["label"].position.set(x + 5, y + 5, z);
        }
    }

    // Lerp between the physio and Cola positions of the nodes
    // 0 <= t <= 1
    setNodePositionsLerp(colaCoords1: number[][], colaCoords2: number[][], t: number) {
        
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            var x, y, z;
            x = colaCoords1[0][i] * (1 - t) + colaCoords2[0][i] * t;
            y = colaCoords1[1][i] * (1 - t) + colaCoords2[1][i] * t;
            z = colaCoords1[2][i] * (1 - t) + colaCoords2[2][i] * t;
            this.nodeMeshes[i].position.set(x, y, z);
            this.nodeInfo[i]["label"].position.set(x + 5, y + 5, z);
        }
    }

    setVisible(flag: boolean) {
        if (flag) {
            if (!this.visible) {
                this.parentObject.add(this.rootObject);
                this.visible = true;
            }
        } else {
            if (this.visible) {
                this.parentObject.remove(this.rootObject);
                this.visible = false;
            }
        }
    }

    isVisible() {
        return this.visible;
    }

    // used by physioGraph
    applyNodeFiltering() {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.rootObject.remove(this.nodeMeshes[i]);
            this.nodeMeshes[i].userData.filtered = true;
        }

        if (this.filteredNodeIDs) {
            for (var j = 0; j < this.filteredNodeIDs.length; ++j) {
                var nodeID = this.filteredNodeIDs[j];

                this.rootObject.add(this.nodeMeshes[nodeID]);
                this.nodeMeshes[nodeID].userData.filtered = false;
            }
        }
    }

    findNodeConnectivity(filteredAdjMatrix, dissimilarityMatrix, edges: any[]) {

        var hasNeighbours = Array<boolean>(this.nodeMeshes.length);
        for (var i = 0; i < this.nodeMeshes.length - 1; ++i) {
            for (var j = i + 1; j < this.nodeMeshes.length; ++j) {
                if (filteredAdjMatrix[i][j] === 1) {
                    if (this.filteredNodeIDs) {
                        if ((this.filteredNodeIDs.indexOf(i) != -1) && (this.filteredNodeIDs.indexOf(j) != -1)) {
                            var len = dissimilarityMatrix[i][j];
                            if (edges) edges.push({ source: i, target: j, length: len });
                            hasNeighbours[i] = true;
                            hasNeighbours[j] = true;
                        }
                    } else {
                        var len = dissimilarityMatrix[i][j];
                        if (edges) edges.push({ source: i, target: j, length: len });
                        hasNeighbours[i] = true;
                        hasNeighbours[j] = true;
                    }
                } else if (filteredAdjMatrix[j][i] === 1) {
                    if (this.filteredNodeIDs) {
                        if ((this.filteredNodeIDs.indexOf(i) != -1) && (this.filteredNodeIDs.indexOf(j) != -1)) {
                            var len = dissimilarityMatrix[i][j];
                            if (edges) edges.push({ source: j, target: i, length: len });
                            hasNeighbours[i] = true;
                            hasNeighbours[j] = true;
                        }
                    } else {
                        var len = dissimilarityMatrix[i][j];
                        if (edges) edges.push({ source: j, target: i, length: len });
                        hasNeighbours[i] = true;
                        hasNeighbours[j] = true;
                    }
                }

            }
        }

        this.nodeHasNeighbors = hasNeighbours.slice(0);
    }

    // used by 

    setNodeVisibilities() {
        if (!this.nodeHasNeighbors) return;

        for (var i = 0; i < this.nodeHasNeighbors.length; ++i) {
            if (this.nodeHasNeighbors[i]) {
                if (this.filteredNodeIDs) {
                    if (this.filteredNodeIDs.indexOf(i) != -1) {
                        this.rootObject.add(this.nodeMeshes[i]);
                        this.nodeMeshes[i].userData.filtered = false;
                    }
                    else {
                        this.rootObject.remove(this.nodeMeshes[i]);
                        this.nodeMeshes[i].userData.filtered = true;
                    }
                }
                else {
                    this.rootObject.add(this.nodeMeshes[i]);
                    this.nodeMeshes[i].userData.filtered = false;
                }
            }
            else {
                this.rootObject.remove(this.nodeMeshes[i]);
                this.nodeMeshes[i].userData.filtered = true;
            }
        }
    }

    highlightSelectedNodes(filteredIDs: number[]) {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            if (filteredIDs.indexOf(i) == -1) {
                this.nodeMeshes[i].material.color.setHex(this.nodeCurrentColor[i]);
            }
            else {
                this.nodeMeshes[i].material.color.setHex(0xFFFF00); // highlight color
            }
        }
    }

    setDefaultNodeScale() {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].scale.set(1, 1, 1);
        }
    }

    setDefaultNodeColor() {
        const DEFAULT_COLOR = {
            color: 0xcfcfcf,
            portion: 1
        };
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeCurrentColor[i] = DEFAULT_COLOR.color;
            this.nodeMeshes[i].material.color.setHex(DEFAULT_COLOR.color);
            this.nodeMeshes[i].userData.colors = [DEFAULT_COLOR];
        }
        // Also reset edge color if set to node
        if (this.colorMode === "node") {
            for (var i = 0; i < this.edgeList.length; i++) {
                var edge = this.edgeList[i];
                edge.isColorChanged = true;
            }
        }
    }

    setNodesScale(scaleArray: number[]) {
        if (!scaleArray) return;
        if (scaleArray.length != this.nodeMeshes.length) return;

        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            var scale = scaleArray[i];
            this.nodeMeshes[i].scale.set(scale, scale, scale);
        }
    }

    //////////////////////////////////////////////
    /////// Edge's Functions /////////////////////
    //////////////////////////////////////////////

    setEdgeDirection(directionMode) {
        if (this.edgeDirectionMode === directionMode) return;

        // remove old direction mode
        if (this.edgeDirectionMode === "arrow") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].toggleArrow(false);
            }
        } else if (this.edgeDirectionMode === "animation") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].uniforms.isAnimationOn.value = 0;;
            }
        } else if (this.edgeDirectionMode === "opacity") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].setOpacity(1, 1);
            }
        } else if (this.edgeDirectionMode === "gradient") {
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
        } else if (directionMode === "animation") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].directionMode = directionMode;
                this.edgeList[i].uniforms.isAnimationOn.value = 1;
                this.edgeList[i].updateColor();
            }
        } else if (directionMode === "opacity") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].directionMode = directionMode;
                this.edgeList[i].setOpacity(-0.5, 1);;
                this.edgeList[i].updateColor();
            }
        } else if (directionMode === "gradient") {
            for (var i = 0; i < this.edgeList.length; i++) {
                this.edgeList[i].directionMode = directionMode;
                this.edgeList[i].updateColor();
            }
        }
    }

    setEdgeOpacity(opacity: number) {

        for (var i = 0; i < this.edgeList.length; i++) {
            var edge = this.edgeList[i];
            edge.uniforms.endOpacity.value = opacity;
            if (this.edgeDirectionMode !== "opacity") {
                edge.uniforms.startOpacity.value = opacity;
            }
            edge.isColorChanged = true;
        }
    }

    setEdgeDirectionGradient() {
        var startRGB = CommonUtilities.hexToRgb(this.saveObj.edgeSettings.directionStartColor, 1.0);
        var endRGB = CommonUtilities.hexToRgb(this.saveObj.edgeSettings.directionEndColor, 1.0);
        for (var i = 0; i < this.edgeList.length; i++) {
            var edge = this.edgeList[i];
            edge.uniforms.startColor.value = new THREE.Vector4(startRGB.r / 255, startRGB.g / 255, startRGB.b / 255, 1.0);
            edge.uniforms.endColor.value = new THREE.Vector4(endRGB.r / 255, endRGB.g / 255, endRGB.b / 255, 1.0);
        }
    }

    setEdgeColorConfig(colorMode: string, config?) {
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

            } else if (config.type === "discrete") {
                var func = d3.scale.ordinal()
                    .domain(config.valueArray)
                    .range(config.colorArray);

                for (var i = 0; i < this.edgeList.length; i++) {
                    var edge = this.edgeList[i];
                    edge.colorMode = colorMode;
                    edge.colorMapFunction = func;
                    edge.isColorChanged = true;
                }
            } else if (config.type === "continuous-discretized") {
                var colorArray = config.colorArray.slice(0);
                var domainArray = config.domainArray.slice(0);
                colorArray.unshift("#000000");
                colorArray.push("#000000");
                domainArray[domainArray.length - 1] += 0.00000001

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
        } else if (colorMode === "node") {
            for (var i = 0; i < this.edgeList.length; i++) {
                var edge = this.edgeList[i];
                edge.colorMode = colorMode;
                edge.isColorChanged = true;
            }
        } else {        // (colorMode === "none")
            for (var i = 0; i < this.edgeList.length; i++) {
                var edge = this.edgeList[i];
                edge.colorMode = colorMode;
                edge.isColorChanged = true;
            }
        }
    }


    setEdgeVisibilities(visMatrix: number[][]) {
        var len = visMatrix.length;
        // reset minWeight and maxWeight values of the edges
        this.edgeMaxWeight = Number.MIN_VALUE;
        this.edgeMinWeight = Number.MAX_VALUE;

        // reset node's hasVisibleEdges flag
        for (var i = 0; i < len - 1; ++i) {
            this.nodeMeshes[i].userData.hasVisibleEdges = false;
        }
        // reset Edges' Visibilities 
        for (var i = 0; i < len - 1; ++i) {
            for (var j = i + 1; j < len; ++j) {
                if (this.edgeMatrix[i][j] || this.edgeMatrix[j][i]) {
                    var edge = (this.edgeMatrix[i][j]) ? this.edgeMatrix[i][j] : this.edgeMatrix[j][i];

                    if (this.filteredNodeIDs && ((this.filteredNodeIDs.indexOf(i) == -1) || (this.filteredNodeIDs.indexOf(j) == -1))) {
                        edge.setVisible(false);
                    } else if (visMatrix[i][j] === 1 || visMatrix[j][i] === 1) {
                        this.nodeMeshes[i].userData.hasVisibleEdges = true;
                        this.nodeMeshes[j].userData.hasVisibleEdges = true;
                        edge.setVisible(true);
                    } else {
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
        } else {
            this.setEdgeColorConfig(this.colorMode);
        }
    }

    addBundlingEdge(line) {
        (<any>line).isBundlingEdge = true;
        this.bundlingEdgeList.push(line);
        this.rootObject.add(line);
    }

    removeAllBundlingEdges() {
        for (var i = 0; i < this.bundlingEdgeList.length; ++i) {
            this.rootObject.remove(this.bundlingEdgeList[i]);
        }

        // remove all elements in the list
        this.bundlingEdgeList.splice(0, this.bundlingEdgeList.length);
    }

    removeAllEdges() {
        for (var i = 0; i < this.edgeList.length; i++) {
            var e = this.edgeList[i];
            if (e.visible) {
                e.setVisible(false);
            }
        }
    }

    //////////////////////////////////////////////
    /////// Label's Functions ////////////////////
    //////////////////////////////////////////////
    showAllLabels(ignore3dControl: boolean, bCola: boolean) {
        this.hideAllLabels();

        for (var i = 0; i < this.nodeInfo.length; ++i) {
            if (this.nodeInfo[i]["label"]) {
                if (!ignore3dControl) {
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
    }

    hideAllLabels() {
        for (var i = 0; i < this.nodeInfo.length; ++i) {
            if (this.nodeInfo[i]["label"]) {
                this.rootObject.remove(this.nodeInfo[i]["label"]);
            }
        }
    }


    setEdgeScale(scale: number) {
        this.edgeList.forEach(function (edge) {
            edge.setScale(scale);
        });
    }

    setNodesColor(colorArray: { color: number, portion: number }[][]) {
        if (!colorArray) return;
        if (colorArray.length != this.nodeMeshes.length) {
            throw "ERROR: ColorArray (" + colorArray.length + ") and NodeMeshes (" + this.nodeMeshes.length + ") do not match";
        }
        this.nodeCurrentColor = colorArray.map(a => this.averageColor(a)); // Use average colour

        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].material.color.set(this.nodeCurrentColor[i]);
            this.nodeMeshes[i].userData.colors = colorArray[i];
        }

        // Also reset edge color if set to node
        if (this.colorMode === "node") {
            for (var i = 0; i < this.edgeList.length; i++) {
                var edge = this.edgeList[i];
                edge.isColorChanged = true;
            }
        }

    }

    getNodeColor(id: number) {
        return this.nodeMeshes[id].material.color.getHex();
    }

    setNodeColor(id: number, color: number) {
        this.nodeMeshes[id].material.color.setHex(color);
    }

    selectNode(id: number, ignore3dControl: boolean, bCola: boolean) {

        if (!this.nodeInfo[id].isSelected) {
            this.nodeInfo[id].isSelected = true;
            var x = this.nodeMeshes[id].scale.x;
            var y = this.nodeMeshes[id].scale.y;
            var z = this.nodeMeshes[id].scale.z;

            this.nodeMeshes[id].scale.set(2 * x, 2 * y, 2 * z);

            if (this.allLabels == false) {
                if (!ignore3dControl) {
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
                    if (edge.visible) {
                        edge.multiplyScale(2);
                    }
                }
            }
        }
    }

    deselectNode(id: number) {
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
                    if (edge.visible) {
                        edge.multiplyScale(0.5);
                    }
                }
            }
        }
    }



    update() {
        var weightEdges = this.edgeThicknessByWeight;
        this.edgeList.forEach(edge => {
            edge.update(weightEdges);
        });
    }

    // Remove self from the scene so that the object can be GC'ed
    destroy() {
        this.parentObject.remove(this.rootObject);
    }
}

class Edge {
    shape;
    geometry;
    cone;
    pointer;
    visible: boolean = true;

    sourceNode;
    targetNode;
    parentObject;
    saveObj;

    // Time control
    timeTracker;

    // unit shape
    unitRadius = 0.5;
    unitLength = 2;

    // edge's width
    baseScale = 1;
    scaleWeight = 0.5 * this.baseScale;
    scaleNoWeight = this.baseScale;

    directionMode: string; // none, animation, arrow, opacity

    // Edge's color
    colorMode: string; // none, weight, node
    color: string;
    canvas;
    isColorChanged: boolean = false;


    // by weight
    colorMapFunction;
    // by node
    //sourceColor: string;
    //targetColor: string;

    //Shaders
    uniforms;
    vertexShader;

    fragmentShader;

    
    constructor(graph, sourceNode, targetNode, private weight) {
        this.timeTracker = new Date().getMilliseconds();
        this.parentObject = graph.rootObject;
        this.saveObj = graph.saveObj;
        this.targetNode = targetNode;
        this.sourceNode = sourceNode;
        this.directionMode = "none";
        this.colorMode = "node";
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
        "	gl_FragColor = color;" + //R G B A
        "}";

        this.initializeCylinder();
        (<any>this.shape).isEdge = true; // A flag to identify the edge
        this.parentObject.add(this.shape);

        var w = (Math.ceil(weight * 10) - 6) * 0.5; // the edge scale is not proportional to edge weight
        if (w < 0) w = 0;
        this.scaleWeight += w;
    }

    getWeight() {
        return this.weight;
    }

    toggleArrow(show: boolean) {
        this.pointer.visible = show;
    }


    initializeCylinder() {        
        this.geometry = new THREE.CylinderGeometry(this.unitRadius, this.unitRadius, this.unitLength, 12);
        this.cone = new THREE.CylinderGeometry(this.unitRadius, this.unitRadius * 3, this.unitLength / 5, 12);
        // Material 
        // using local positions 
        this.uniforms.startPos.value = new THREE.Vector3(0, this.unitLength / 2, 0);
        this.uniforms.endPos.value = new THREE.Vector3(0, -this.unitLength / 2, 0);

        this.uniforms.startColor.value = new THREE.Vector4(1.0, 0, 0, 1.0);
        this.uniforms.endColor.value = new THREE.Vector4(0, 0, 1.0, 1.0);

        var material = new THREE.ShaderMaterial(<any>{
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            transparent: true,
            depthWrite: false
        });
        this.shape = new THREE.Mesh(this.geometry, material);
        this.shape.renderOrder = RENDER_ORDER_EDGE; // Draw line BEFORE transparent brain model is drawn
        this.pointer = new THREE.Mesh(this.cone, new THREE.MeshBasicMaterial({
            color: 0x000000
        }));
        this.pointer.position.set(0, this.unitLength * 2 / 5, 0);
        this.pointer.visible = false;
        this.shape.add(this.pointer);

    }

    initializeLine() {
        this.geometry = new THREE.Geometry();
        this.geometry.vertices.push(
            new THREE.Vector3(0, this.unitLength / 2, 0),
            new THREE.Vector3(0, -this.unitLength / 2, 0)
            );
        this.cone = new THREE.CylinderGeometry(this.unitRadius, this.unitRadius * 3, this.unitLength / 5, 12);
        // Material 
        // using local positions 
        this.uniforms.startPos.value = new THREE.Vector3(0, this.unitLength / 2, 0);
        this.uniforms.endPos.value = new THREE.Vector3(0, -this.unitLength / 2, 0);

        this.uniforms.startColor.value = new THREE.Vector4(1.0, 0, 0, 1.0);
        this.uniforms.endColor.value = new THREE.Vector4(0, 0, 1.0, 1.0);

        var material = new THREE.ShaderMaterial(<any>{
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            transparent: true,
            depthWrite: false
        });
        this.shape = new THREE.Line(this.geometry, material);
        this.shape.renderOrder = RENDER_ORDER_EDGE; // Draw line BEFORE transparent brain model is drawn
        this.pointer = new THREE.Mesh(this.cone, new THREE.MeshBasicMaterial({
            color: 0x000000
        }));
        this.pointer.position.set(0, this.unitLength * 2 / 5, 0);
        this.pointer.visible = false;
        this.shape.add(this.pointer);

    }

    setOpacity(startOpacity, endOpacity) {
        this.uniforms.startOpacity.value = startOpacity;
        this.uniforms.endOpacity.value = endOpacity;
    }

    updateColor() {
        this.isColorChanged = false;

        // Overwriter current color setting if directionMode is gradient
        if (this.directionMode === "gradient") {
            var startRGB = CommonUtilities.hexToRgb(this.saveObj.edgeSettings.directionStartColor, 1.0);
            var endRGB = CommonUtilities.hexToRgb(this.saveObj.edgeSettings.directionEndColor, 1.0);
            this.uniforms.startColor.value = new THREE.Vector4(
                startRGB.r / 255,
                startRGB.g / 255,
                startRGB.b / 255, 1.0);
            this.uniforms.endColor.value = new THREE.Vector4(
                endRGB.r / 255,
                endRGB.g / 255,
                endRGB.b / 255, 1.0);
            return;
        }

        if (this.colorMode === "weight" || this.colorMode === "none") {
            var color = new THREE.Color(this.color);
            this.uniforms.startColor.value = new THREE.Vector4(color.r, color.g, color.b, 1.0);
            this.uniforms.endColor.value = new THREE.Vector4(color.r, color.g, color.b, 1.0);

        } else if (this.colorMode === "node") {
            var sourceColor = new THREE.Color("#" + this.sourceNode.material.color.getHexString());
            var targetColor = new THREE.Color("#" + this.targetNode.material.color.getHexString());

            this.uniforms.startColor.value = new THREE.Vector4(sourceColor.r, sourceColor.g, sourceColor.b, 1.0);
            this.uniforms.endColor.value = new THREE.Vector4(targetColor.r, targetColor.g, targetColor.b, 1.0);
        }
    }

    getColor() {
        return this.color;
    }

    setScale(scale: number) {
        this.baseScale = scale;

        this.scaleNoWeight = this.baseScale;

        this.scaleWeight = this.baseScale * 0.5;
        var w = (Math.ceil(this.weight * 10) - 6) * 0.5; // the edge scale is not proportional to edge weight
        if (w < 0) w = 0;
        this.scaleWeight += w;
    }

    multiplyScale(s: number) {
        this.scaleWeight *= s;
        this.scaleNoWeight *= s;
    }

    setVisible(flag: boolean) {
        if (flag) {
            if (!this.visible) {
                this.parentObject.add(this.shape);
                this.visible = true;
            }
        } else {
            if (this.visible) {
                this.parentObject.remove(this.shape);
                this.visible = false;
            }
        }
    }

    update(weightEdges: boolean) {
        // update animation time
        this.timeTracker = new Date().getMilliseconds();
        this.uniforms.timeTracker.value = this.timeTracker / 1000;

        this.geometry.verticesNeedUpdate = true;
        var scale = 1;

        /* update width of the edge */
        if (weightEdges) {
            scale = this.scaleWeight;
        } else {
            scale = this.scaleNoWeight;
        }

        /* draw the cylinder? (check the code again) */
        var a = this.sourceNode.position, b = this.targetNode.position;
        var m = new THREE.Vector3();
    
        m.addVectors(a, b).divideScalar(2);
        this.shape.position.set(m.x, m.y, m.z);
        var origVec = new THREE.Vector3(0, 1, 0);         //vector of cylinder
        var targetVec = new THREE.Vector3();
        targetVec.subVectors(b, a);
     
        var length = targetVec.length();

        //if (length === 0) {
        //    this.parentObject.remove(this.shape);
        //    return;
        //}

        this.shape.scale.set(scale, length / this.unitLength, scale);
        targetVec.normalize();
     
        var angle = Math.acos(origVec.dot(targetVec));
     
        var axis = new THREE.Vector3();
        axis.crossVectors(origVec, targetVec);
        axis.normalize();
        
        this.shape.quaternion.setFromAxisAngle(axis, angle);

        /* update color of the edge */
        if (this.isColorChanged) {
            if (this.colorMode === "weight") {
                this.color = this.colorMapFunction(this.weight);
            } else {
                this.color = "#cfcfcf";
            }

            this.updateColor();
        }

    }
}
