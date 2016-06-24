/// <reference path="../extern/three.d.ts"/>
/// <reference path="../extern/jquery.d.ts"/>
/// <reference path="../extern/jqueryui.d.ts"/>
/**
    This file contains all the control logic for brainapp.html (to manage interaction with
    the page, and the execution of applications/visualisations within the four views).

    Not implemented: removal of applications
*/
declare var dc;
declare var crossfilter;
declare var jsyaml;
declare var extra;
// Holds data common to all datasets, and sends notifications when data changes
class CommonData {

    public selectedNode = -1;
    public nodeIDUnderPointer: number[] = [-1, -1, -1, -1, -1]; // for yoked display; the last one is for svg graphs
    public circularBar1ColorPicker;
    public circularBar2ColorPicker;

    public edgeColorMode = "none";
    public edgeWeightColorMode = "";
    public edgeForceContinuous = false;

    coordCallbacks: Array<() => void> = new Array();
    labelCallbacks: Array<() => void> = new Array();
    surfaceCallbacks: Array<() => void> = new Array();

    regNotifyCoords(callback: () => void) {
        this.coordCallbacks.push(callback);
    }
    regNotifyLabels(callback: () => void) {
        this.labelCallbacks.push(callback);
    }
    regNotifySurface(callback: () => void) {
        this.surfaceCallbacks.push(callback);
    }
    // TODO: add deregistration capability
    notifyCoords() {
        this.coordCallbacks.forEach(function (c) { c() });
    }
    notifyLabels() {
        this.labelCallbacks.forEach(function (c) { c() });
    }
    notifySurface() {
        this.surfaceCallbacks.forEach(function (c) { c() });
    }
}

// Holds data for a specific dataset, and sends notifications when data changes
class DataSet {
    public simMatrix: number[][];
    public brainCoords: number[][];
    public brainLabels: string[];
    public attributes: Attributes = null;
    public info;
    public sortedSimilarities;
    simCallbacks: Array<() => void> = new Array();
    attCallbacks: Array<() => void> = new Array();

    constructor() {

        this.info = {
            nodeCount: undefined,
            edgeWeight: {
                type: "",
                distincts: []
            },
            isSimatricalMatrix: true
        };
    }

    verify() {
        if (this.simMatrix.length === 0) {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Similarity Matrix is not loaded!");
            return false;
        }

        if (this.brainCoords.length === 0) {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Node Coordinates is not loaded!");
            return false;
        }

        if (!this.attributes) {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Attributes are not loaded!");
            return false;
        }

        if (this.brainCoords[0].length !== this.attributes.numRecords) {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Attributes and Coordinates files do not match!");
            return false;
        }

        if (this.brainCoords[0].length !== this.simMatrix.length) {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Similarity Matrix and Coordinates files do not match!");
            return false;
        }

        return true;
    }

    clone() {
        var newDataset = new DataSet();

        // clone simMatrix
        var newSimMatrix = [];
        for (var i = 0; i < this.simMatrix.length; i++) {
            newSimMatrix.push(this.simMatrix[i].slice(0));
        }

        // clone brain coords
        var newBrainCoords = []
        for (var i = 0; i < this.brainCoords.length; i++) {
            newBrainCoords.push(this.brainCoords[i].slice(0));
        }

        // clone brain lables
        if (this.brainLabels) var newBrainLabels = this.brainLabels.slice(0);

        // clone attribute
        var newAttr = this.attributes.clone();

        // clone sortedSimilarities
        var newSorted = this.sortedSimilarities.slice(0);

        // clone info object
        var newInfo = jQuery.extend({}, this.info);

        newDataset.simMatrix = newSimMatrix;
        newDataset.brainCoords = newBrainCoords;
        newDataset.brainLabels = newBrainLabels;
        newDataset.attributes = newAttr;
        newDataset.sortedSimilarities = newSorted;
        newDataset.info = newInfo;

        return newDataset;

    }

    //
    adjMatrixWithoutEdgesCrossHemisphere(count: number) {
        var max = this.info.nodeCount * (this.info.nodeCount - 1) / 2;
        if (count > max) count = max;
        if (count > this.sortedSimilarities.length) count = this.sortedSimilarities.length;
        var threshold = this.sortedSimilarities[count - 1];
        var adjMatrix: number[][] = Array<Array<number>>(this.info.nodeCount);

        for (var i = 0; i < this.info.nodeCount; ++i) {
            adjMatrix[i] = new Array<number>(this.info.nodeCount);
        }

        for (var i = 0; i < this.info.nodeCount - 1; ++i) {

            for (var j = i + 1; j < this.info.nodeCount; ++j) {

                var isSameSide = (this.brainCoords[0][i] * this.brainCoords[0][j] > 0);
                var val = this.simMatrix[i][j];
                if (val >= threshold && isSameSide) { // Accept an edge between nodes that are at least as similar as the threshold value
                    adjMatrix[i][j] = 1;
                }
                else {
                    adjMatrix[i][j] = 0;
                }

                val = this.simMatrix[j][i];
                if (val >= threshold && isSameSide) { // Accept an edge between nodes that are at least as similar as the threshold value
                    adjMatrix[j][i] = 1;
                }
                else {
                    adjMatrix[j][i] = 0;
                }
            }
        }
        return adjMatrix;
    }
    // Create a matrix where a 1 in (i, j) means the edge between node i and node j is selected
    adjMatrixFromEdgeCount(count: number) {
        var max = this.info.nodeCount * (this.info.nodeCount - 1) / 2;
        if (count > max) count = max;
        if (count > this.sortedSimilarities.length) count = this.sortedSimilarities.length;
        var threshold = this.sortedSimilarities[count - 1];
        var adjMatrix: number[][] = Array<Array<number>>(this.info.nodeCount);

        for (var i = 0; i < this.info.nodeCount; ++i) {
            adjMatrix[i] = new Array<number>(this.info.nodeCount);
        }


        for (var i = 0; i < this.info.nodeCount - 1; ++i) {

            for (var j = i + 1; j < this.info.nodeCount; ++j) {
                var val = this.simMatrix[i][j];
                if (val >= threshold) { // Accept an edge between nodes that are at least as similar as the threshold value
                    adjMatrix[i][j] = 1;
                }
                else {
                    adjMatrix[i][j] = 0;
                }

                val = this.simMatrix[j][i];
                if (val >= threshold) { // Accept an edge between nodes that are at least as similar as the threshold value
                    adjMatrix[j][i] = 1;
                }
                else {
                    adjMatrix[j][i] = 0;
                }
            }
        }
        return adjMatrix;
    }

    getRecord(index: number) {
        var record = {};
        var columns = this.attributes.columnNames.length;

        if (this.brainLabels) record["label"] = this.brainLabels[index];
        record["id"] = index;

        for (var i = 0; i < columns; ++i) {
            var value = this.attributes.attrValues[i][index];
            record[this.attributes.columnNames[i]] = value;
        }

        return record;
    }

    setSimMatrix(simMatrix) {
        this.simMatrix = simMatrix;
        this.info.isSimatricalMatrix = CommonUtilities.isSimatrical(this.simMatrix);

        this.sortedSimilarities = [];

        // Sort the similarities into a list so we can filter edges
        for (var i = 0; i < this.simMatrix.length; ++i) {

            for (var j = i + 1; j < this.simMatrix[i].length; ++j) {
                var value = (this.simMatrix[i][j] > this.simMatrix[j][i]) ? this.simMatrix[i][j] : this.simMatrix[j][i];
                this.sortedSimilarities.push(value);
            }
        }
        this.sortedSimilarities.sort(function (a, b) { return b - a; });

        // remove edges with weight === 0
        var index = this.sortedSimilarities.indexOf(0);
        this.sortedSimilarities.splice(index, this.sortedSimilarities.length - index);

        //---------------------------------------------------------------------------------------------------------
        // Inspect Dataset (for now only inspect edge weights values)
        // inspect edge weights
        var distincts;
        if (CommonUtilities.isDiscreteValues(this.sortedSimilarities, 20)) {
            this.info.edgeWeight.type = "discrete";
            this.info.edgeWeight.distincts = CommonUtilities.getDistinctValues(this.sortedSimilarities);
        } else {
            this.info.edgeWeight.type = "continuous";
        }

        // Notify all registered 
        this.notifySim();
    }

    regNotifySim(callback: () => void) {
        this.simCallbacks.push(callback);
    }
    regNotifyAttributes(callback: () => void) {
        this.attCallbacks.push(callback);
    }
    // TODO: add deregistration capability
    notifySim() {
        this.simCallbacks.forEach(function (c) { c() });
    }
    notifyAttributes() {
        this.attCallbacks.forEach(function (c) { c() });
    }
}

class SaveFile {
    // user-uploaded file names
    loadExampleData: boolean = false;
    serverFileNameCoord: string;
    serverFileNameMatrix: string;
    serverFileNameAttr: string;
    serverFileNameLabel: string;

    // UI Settings
    surfaceSettings;
    edgeSettings;
    nodeSettings;

    // brain apps
    saveApps: SaveApp[];

    // cross filter
    filteredRecords: any[];

    constructor() {

        this.edgeSettings = {
            colorBy: "none", // node (default), none or weight 
            size: 1, // default
            directionMode: "none",
            directionStartColor: "#FF0000",
            directionEndColor: "#0000FF",
            weight: {
                type: "",
                discretizedSetting: {
                    numCategory: 1,
                    domainArray: [],
                    colorArray: []
                },
                continuousSetting: {
                    maxColor: "",
                    minColor: "",
                },
                discreteSetting: {
                    colorArray: [],
                    valueArray: []
                }
            }
        };

        this.nodeSettings = {
            nodeSizeOrColor: '',
            nodeSizeAttribute: '',
            nodeSizeMin: 1,
            nodeSizeMax: 1,

            nodeColorAttribute: '',
            nodeColorMode: '',
            nodeColorDiscrete: [],
            nodeColorContinuousMin: '',
            nodeColorContinuousMax: ''
        };

        this.surfaceSettings = {
            opacity: 0.5
        };
        this.saveApps = new Array(4);
        for (var i = 0; i < 4; i++) {
            this.saveApps[i] = null;
        }
    }

    toYaml() {

        var yamlObj = {};

        yamlObj["Example Data"] = (this.loadExampleData) ? "Yes" : "No";
        yamlObj["Edge Settings"] = {
            "Color By": this.edgeSettings.colorBy,
            "Size": this.edgeSettings.size
        };

        if (this.edgeSettings.colorBy === "weight") {
            yamlObj["Edge Settings"]["Weight"] = {
                "Type": this.edgeSettings.weight.type
            }
            if (this.edgeSettings.weight.type === "discrete") {
                yamlObj["Edge Settings"]["Weight"]["Color List"] = this.edgeSettings.weight.discreteSetting.colorArray;
                yamlObj["Edge Settings"]["Weight"]["Value List"] = this.edgeSettings.weight.discreteSetting.valueArray;
            } else if (this.edgeSettings.weight.type === "continuous-discretized") {
                yamlObj["Edge Settings"]["Weight"]["Number of Category"] = this.edgeSettings.weight.discretizedSetting.numCategory;
                yamlObj["Edge Settings"]["Weight"]["Domain List"] = this.edgeSettings.weight.discretizedSetting.domainArray;
                yamlObj["Edge Settings"]["Weight"]["Color List"] = this.edgeSettings.weight.discretizedSetting.colorArray;
            } else if (this.edgeSettings.weight.type === "continuous-normal") {
                yamlObj["Edge Settings"]["Weight"]["Max Value Color"] = this.edgeSettings.weight.continuousSetting.maxColor;
                yamlObj["Edge Settings"]["Weight"]["Min Value Color"] = this.edgeSettings.weight.continuousSetting.minColor;
            }
        }

        yamlObj["Node Settings"] = {
            "Size Attribute": this.nodeSettings.nodeSizeAttribute,
            "Max Size": this.nodeSettings.nodeSizeMin,
            "Min Size": this.nodeSettings.nodeSizeMax,
            "Color Attribute": this.nodeSettings.nodeColorAttribute,
            "Discrete Color List": this.nodeSettings.nodeColorDiscrete,
            "Continuous Color Min": this.nodeSettings.nodeColorContinuousMin,
            "Continuous Color Max": this.nodeSettings.nodeColorContinuousMax
        };
        yamlObj["Brain Settings"] = {
            "Transparency": this.surfaceSettings.opacity
        };

        for (var i = 0; i < 4; i++) {
            if (this.saveApps[i]) {
                yamlObj["viewport" + i] = this.saveApps[i].toYaml();
            }
        }

        return jsyaml.safeDump(yamlObj);
    }

    fromYaml(yaml) {
        var yamlObj = jsyaml.safeLoad(yaml);

        this.loadExampleData = (yamlObj["example data"] === "yes");
        this.edgeSettings.colorBy = yamlObj["edge settings"]["color by"];
        this.edgeSettings.size = yamlObj["edge settings"]["size"];

        if (this.edgeSettings.colorBy === "weight") {
            this.edgeSettings.weight.type = yamlObj["edge settings"]["weight"]["type"];

            if (this.edgeSettings.weight.type === "discrete") {
                this.edgeSettings.weight.discreteSetting.colorArray = yamlObj["edge settings"]["weight"]["color list"];
                this.edgeSettings.weight.discreteSetting.valueArray = yamlObj["edge settings"]["weight"]["value list"];
            } else if (this.edgeSettings.weight.type === "continuous-discretized") {
                this.edgeSettings.weight.discretizedSetting.numCategory = yamlObj["edge settings"]["weight"]["number of category"];
                this.edgeSettings.weight.discretizedSetting.domainArray = yamlObj["edge settings"]["weight"]["domain list"];
                this.edgeSettings.weight.discretizedSetting.colorArray = yamlObj["edge settings"]["weight"]["color list"];
            } else if (this.edgeSettings.weight.type === "continuous-normal") {
                this.edgeSettings.weight.continuousSetting.maxColor = yamlObj["edge settings"]["weight"]["max value color"];
                this.edgeSettings.weight.continuousSetting.minColor = yamlObj["edge settings"]["weight"]["min value color"];
            }
        }

        this.nodeSettings = {
            nodeSizeOrColor: "node-color",
            nodeSizeAttribute: yamlObj["node settings"]["size attribute"],
            nodeSizeMin: yamlObj["node settings"]["max size"],
            nodeSizeMax: yamlObj["node settings"]["min size"],

            nodeColorAttribute: yamlObj["node settings"]["color attribute"],
            nodeColorContinuousMin: yamlObj["node settings"]["continuous color min"],
            nodeColorContinuousMax: yamlObj["node settings"]["continuous color max"],
            nodeColorDiscrete: yamlObj["node settings"]["discrete color list"]
        };

        this.surfaceSettings.opacity = yamlObj["brain settings"]["transparency"];


        for (var i = 0; i < 4; i++) {
            if (yamlObj["viewport" + i]) {
                this.saveApps[i] = new SaveApp();
                this.saveApps[i].fromYaml(yamlObj["viewport" + i]);
            }
        }
    }
}
class SaveApp {
    //determine which brain surface model
    surfaceModel: string;
    brainSurfaceMode;
    view: string;

    dataSet: DataSet;

    // determine which viewport
    setDataSetView: string;

    // determine edgeCount setting
    edgeCount: number;

    // which network is open
    showingTopologyNetwork: boolean;
    networkType: string;

    // extra option for circular layout:
    circularBundleAttribute: string;
    circularSortAttribute: string;
    circularLableAttribute: string;
    circularEdgeGradient: boolean;
    circularAttributeBars;

    toYaml() {
        var showGraph = (this.showingTopologyNetwork) ? "Yes" : "No";
        var yamlObj = {
            "Surface Model": this.surfaceModel,
            "Number of Edges": this.edgeCount,
            "Brain Surface Mode": this.brainSurfaceMode,
            "Show Graph": showGraph,
            "Network Type": this.networkType
        }

        if (this.networkType === "circular") {
            yamlObj["circular settings"] = {
                "Bundle Attribute": this.circularBundleAttribute,
                "Sort Attribute": this.circularSortAttribute,
                "Label Attribute": this.circularLableAttribute,
                "Attribute Bars": this.circularAttributeBars
            }
        }

        return yamlObj;
    }

    fromYaml(yamlObj) {
        this.surfaceModel = yamlObj["surface model"];
        this.edgeCount = yamlObj["number of edges"];
        this.brainSurfaceMode = yamlObj["brain surface mode"];
        this.showingTopologyNetwork = (yamlObj["show graph"] === "yes");
        this.networkType = yamlObj["network type"];

        if (this.networkType = "circular") {
            this.circularBundleAttribute = yamlObj["circular settings"]["bundle attribute"];
            this.circularSortAttribute = yamlObj["circular settings"]["sort attribute"];
            this.circularLableAttribute = yamlObj["circular settings"]["label attribute"];
            this.circularAttributeBars = yamlObj["circular settings"]["attribute bars"];
        }
    }
}

// Parses, stores, and provides access to brain node attributes from a file
class Attributes {
    attrValues: number[][][];
    columnNames: string[];
    numRecords: number;
    info;

    filteredRecords: any[];
    filteredRecordsHighlightChanged: boolean = false;

    clone() {
        var newAttr = new Attributes();

        // clone attrValues 
        var newAttrValues = [];
        for (var i = 0; i < this.attrValues.length; i++) {
            newAttrValues.push(this.attrValues[i].slice());
        }

        // clone columnNames
        var newColumnNames = this.columnNames;

        // clone num records
        var newNumRecords = this.numRecords;

        var newInfo = jQuery.extend(true, {}, this.info);

        newAttr.info = newInfo;
        newAttr.attrValues = newAttrValues;
        newAttr.columnNames = newColumnNames;
        newAttr.numRecords = newNumRecords;

        return newAttr;

    }

    constructor(text?: string) {
        if (!text) return;
        this.info = {};
        this.columnNames = [];
        var lines = text.replace(/\t|\,/g, ' ').trim().split(/\r\n|\r|\n/g).map(function (s) { return s.trim() });
        // check the last line:
        var lastline = lines[lines.length - 1].trim();
        if (lastline.length == 0) {
            lines.splice(lines.length - 1, 1);
        }

        // Check if first line contains labels
        var firstWords = lines[0].split(' ');
        for (var i = 0; i < firstWords.length && this.columnNames.length === 0; i++) {
            var column = firstWords[i].replace(/,/g, '|').split("|");
            for (var j = 0; j < column.length; j++) {

                if (isNaN(Number(column[j]))) {
                    this.columnNames = firstWords;
                    lines.shift();// remove if the first line is just labels
                    break;
                }
            }
        }

        // Give default names to attributes
        if (this.columnNames.length === 0) {
            this.columnNames = firstWords.map(function (val, i) {
                return "Attribute" + i;
            });
        }

        this.numRecords = lines.length;
        var numAttributes = this.columnNames.length;

        // Store the values of each attribute by index
        var values = [];
        for (var i = 0; i < numAttributes; ++i) {
            values[i] = [];
        }

        // Add the attributes of each record to the right value list
        var numAttrElements = [];
        for (var i = 0; i < lines.length; ++i) {
            var rec = lines[i].split(' ');
            for (var j = 0; j < numAttributes; ++j) {
                values[j][i] = rec[j].replace(/,/g, '|').split("|").map(function (val) { return parseFloat(val); });

                // Record the nummber of element and compared it to the rest of the record
                if (!numAttrElements[j]) {
                    numAttrElements[j] = values[j][i].length;
                } else {
                    // The number of elements for each attribute has to be the same accross nodes
                    if (numAttrElements[j] != values[j][i].length) {
                        throw "Inconsistent number of element in attribute \"" + this.columnNames[j] + "\"";
                    }   
                }
            }
        }

        // Check number type for each attributes (Discrete or Continuous)
        for (var i = 0; i < this.columnNames.length; i++) {
            if (numAttrElements[i] === 1) {
                this.info[this.columnNames[i]] = {
                    isDiscrete: CommonUtilities.isDiscreteValues(CommonUtilities.concatTwoDimensionalArray(values[i]), 20),
                    numElements: 1
                };
            } else { // If there are more than one element than consider it as discrete (with the values are weights)
                this.info[this.columnNames[i]] = {
                    isDiscrete: true,
                    numElements: numAttrElements[i]
                };
            }


            if (this.info[this.columnNames[i]].isDiscrete && this.info[this.columnNames[i]].numElements === 1) {
                this.info[this.columnNames[i]].distinctValues = CommonUtilities.getDistinctValues(CommonUtilities.concatTwoDimensionalArray(values[i])).sort(function (a, b) {
                    return a - b;
                });
            } else { // If the attribute has multiple elements then distinctValues will be a discrete array
                this.info[this.columnNames[i]].distinctValues = $.map($(Array(this.info[this.columnNames[i]].numElements)), function (val, i) { return i; });
            }
        }

        this.attrValues = values;

    }

    getValue(columnIndex: number, index: number) {

        return this.attrValues[columnIndex][index];
    }

    getMin(columnIndex: number) {
        var array = CommonUtilities.concatTwoDimensionalArray(this.attrValues[columnIndex]);
        array.sort(function (a, b) {
            return a - b;
        });

        return array[0];
    }

    getMax(columnIndex: number) {
        var array = CommonUtilities.concatTwoDimensionalArray(this.attrValues[columnIndex]);
        array.sort(function (a, b) {
            return b - a;
        });

        return array[0];
    }

    get(attribute: string) {
        var columnIndex = this.columnNames.indexOf(attribute);
        if (columnIndex != -1)
            return this.attrValues[columnIndex];
        return null;
    }
}

// Sub-applications implement this interface so they can be notified when they are assigned a or when their view is resized
interface Application {
    brainSurfaceMode;

    setDataSet(dataSet: DataSet);
    resize(width: number, height: number);
    applyFilter(filteredIDs: number[]);
    showNetwork(switchNetwork);

    getDrawingCanvas();

    // Brain Surface
    setBrainMode(brainMode);
    setSurfaceOpacity(opacity);

    // Node Attributes
    setNodeDefaultSizeColor();
    setNodeSize(scaleArray: number[]);
    setNodeColor(attribute: string, minColor: string, maxColor: string);
    setNodeColorDiscrete(attribute: string, keyArray: number[], colorArray: string[]);
    setANodeColor(nodeID: number, color: string);

    // Edge Attributes
    setEdgeDirectionGradient();
    setEdgeDirection(directionMode: string);
    setEdgeSize(size: number);
    setEdgeThicknessByWeight(bool: boolean);
    setEdgeColorByWeight(config);
    setEdgeColorByNode();
    setEdgeNoColor();
    getCurrentEdgeWeightRange();

    highlightSelectedNodes(filteredIDs: number[]);
    isDeleted();
    save(saveApp: SaveApp);
    //init(saveApp: SaveApp);
    initEdgeCountSlider(saveApp: SaveApp);
    initShowNetwork(saveApp: SaveApp);

    update(deltaTime: number);
}
// The loop class can be used to run applications that aren't event-based

interface Loopable {
    update(deltaTime: number): void;
}

class Loop {
    loopable;
    frameTimeLimit;
    timeOfLastFrame;

    constructor(loopable: Loopable, limit: number) {
        this.loopable = loopable;
        this.frameTimeLimit = limit;
        this.timeOfLastFrame = new Date().getTime();

        var mainLoop = () => {
            var currentTime = new Date().getTime();
            var deltaTime = (currentTime - this.timeOfLastFrame) / 1000;
            this.timeOfLastFrame = currentTime;

            for (var i = 0; i < 4; ++i) {
                if (apps[i] && apps[i].isDeleted()) {
                    apps[i] = null;
                    saveObj.saveApps[i] = null; // create a new instance (if an old instance exists)
                }
            }

            // Limit the maximum time step
            if (deltaTime > this.frameTimeLimit)
                this.loopable.update(this.frameTimeLimit);
            else
                this.loopable.update(deltaTime);

            requestAnimationFrame(mainLoop);
        }

        requestAnimationFrame(mainLoop);
    }
}

///////////////////////////////////////////////////////////////////////////////////
// Set up jQuery UI layout objects ////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////


$("[data-toggle='tooltip']").tooltip(<any>{ container: 'body' });

$("#tab2").click(function () {
    setTimeout(function () {
        resetDataSetIcon();
    }, 0);

});

/////////////////////////////////////////////////
//          Upload files buttons              //
////////////////////////////////////////////////
$('#button-select-coords').click(function () {
    $("#select-coords").click();
});
$('#select-coords').on('change', function () {
    // Change the button name according to the file name
    var file = (<any>$('#select-coords').get(0)).files[0];
    document.getElementById("button-select-coords").innerHTML = file.name;

    changeFileStatus("coords-status", "changed");
    
    // parse and upload coordinate file
    uploadCoords();

});

$('#button-select-matrices-batching').click(function () {
    $("#select-matrices-batching").click();
});
$("#select-matrices-batching").on('change', function () {
    var numFiles = (<any>$('#select-matrices-batching').get(0)).files.length;
    document.getElementById("button-select-matrices-batching").innerHTML = numFiles + " files loaded";


    changeFileStatus("matrices-batching-status", "uploaded");

});
$('#button-select-attrs-batching').click(function () {
    $("#select-attrs-batching").click();
});
$("#select-attrs-batching").on('change', function () {
    var numFiles = (<any>$('#select-attrs-batching').get(0)).files.length;
    document.getElementById("button-select-attrs-batching").innerHTML = numFiles + " files loaded";

    changeFileStatus("attrs-batching-status", "uploaded");

});

$('#btn-start-batching').click(function () {
    var matrixFiles = (<any>$('#select-matrices-batching').get(0)).files;
    var attrFiles = (<any>$('#select-attrs-batching').get(0)).files;

    if (matrixFiles.length === attrFiles.length) {

        // Showing modal 
        $("#alertModal")["modal"]({
            backdrop: "static"
        });

        // Reset modal content
        document.getElementById("alertModalTitle").innerHTML = "Batching in progress";
        document.getElementById("alertModalMessage").innerHTML = "Processing " + (i + 1) + " in " + numberOfFiles + " pairs.";

        // Start batching
        var status = 0.0;
        var attributes = (<any>$('#select-attrs-batching').get(0)).files;
        var matrices = (<any>$('#select-matrices-batching').get(0)).files;
        var numberOfFiles = attributes.length;
        var i = 0;

        batchProcess(i, numberOfFiles, attributes, matrices);

    } else {
        CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Number of Files do not match.");
    }

});

function batchProcess(i, numberOfFiles, attributes, matrices) {
    // Load pair of files into dataset
    loadAttributes(attributes[i], dataSet);
    loadSimilarityMatrix(matrices[i], dataSet);

    // Load the new dataset to the app (always use the first viewport - top left);
    setDataset(tl_view);

    // refresh the visualisation with current settings and new data
    apps[0].showNetwork(false);
    setEdgeColor();
    setNodeSizeOrColor();
    apps[0].update(0);

    // Capture and download the visualisation
    exportSVG(0, "svg");

    // update status
    i++;
    var percentage = (i / numberOfFiles) * 100;
    $("#progressBar").css({
        "width": percentage + "%"
    });
    document.getElementById("alertModalMessage").innerHTML = "Processing " + (i + 1) + " in " + numberOfFiles + " pairs.";

    if (i < numberOfFiles) {
        setTimeout(function () {
            batchProcess(i, numberOfFiles, attributes, matrices)
        }, 1000);
    } else {
        $("#alertModal")["modal"]('hide');
    }
}

$('#button-select-matrix').click(function () {
    $("#select-matrix").click();
});
$('#select-matrix').on('change', function () {
    // Change the button name according to the file name
    var file = (<any>$('#select-matrix').get(0)).files[0];
    document.getElementById("button-select-matrix").innerHTML = file.name;

    // update file status to changed
    changeFileStatus("matrix-status", "changed");

    // Parse and upload attribute file
    uploadMatrix();

});

$('#button-select-attrs').click(function () {
    $("#select-attrs").click();
});
$('#select-attrs').on('change', function () {
    // Change the button name according to the file name
    var file = (<any>$('#select-attrs').get(0)).files[0];
    document.getElementById("button-select-attrs").innerHTML = file.name;
    // update file status to changed
    changeFileStatus("attrs-status", "changed");

    // Parse and upload attribute file
    uploadAttr();

});

$('#button-select-labels').click(function () {
    $("#select-labels").click();
});
$('#select-labels').on('change', function () {
    // Change the button name according to the file name
    var file = (<any>$('#select-labels').get(0)).files[0];
    document.getElementById("button-select-labels").innerHTML = file.name;

    // update file status to changed
    changeFileStatus("labels-status", "changed");

    // Parse and upload labels
    uploadLabels();
});


$('#button-load-settings').button().click(function () {
    $("#input-select-load-file").click();
});
$('#input-select-load-file').on('change', loadSettings);

$('#button-save-settings').button().click(function () {
    saveSettings();
});

$('#button-export-svg').button().click(function () {
    $("#exportModal")["modal"](
        );
});

$('#button-export-submit').button().click(function () {
    var viewport = $('#select-export-viewport').val();
    var type = $('#select-export-type').val();

    exportSVG(parseInt(viewport), type)
});

$('#button-save-app').button().click(function () {
    //Save all the apps
    for (var i = 0; i < 4; i++) {
        var app = saveObj.saveApps[i];
        if (apps[i]) apps[i].save(app);
    }

    var saveJson = JSON.stringify(saveObj);
    $.post("brain-app/saveapp.aspx",
        {
            save: saveJson
        },
        function (data, status) {
            if (status.toLowerCase() == "success") {
                var url = document.URL.split('?')[0];
                prompt("The project is saved. Use the following URL to restore the project:", url + "?save=" + data);
            }
            else {
                alert("save: " + status);
            }
        });
});

//$('#accordion').accordion({ heightStyle: 'fill' });
//$('#accordion').accordion({ heightStyle: 'content' });

$('[data-toggle="btns"] .btn').on('click', function () {
    var $this = $(this);
    $this.parent().find('.active').removeClass('active');
    $this.addClass('active');
});

var TYPE_COORD: string = "coordinates";
var TYPE_MATRIX: string = "matrix";
var TYPE_ATTR: string = "attributes";
var TYPE_LABEL: string = "labels";

$('#input-select-model').button();
$('#button-upload-model').button().click(function () {
    var file = (<any>$('#input-select-model').get(0)).files[0];
    if (file) {
        // 1. upload the file to server
        $("#brain3d-icon-front").html("Loading...");
        $("#brain3d-icon-front").draggable("disable");
        var reader = new FileReader();
        reader.onload = function () {
            $.post("brain-app/upload.aspx",
                {
                    fileText: reader.result,
                    fileName: file.name,
                    type: "brain-model"
                },
                function (data, status) {
                    if (status.toLowerCase() == "success") {
                        $("#brain3d-icon-front").html("3D Brain");
                        $("#brain3d-icon-front").draggable("enable");
                        $("#brain3d-icon-front").draggable({
                            zIndex: 100000
                        });
                        $('#label-model')
                            .text("uploaded")
                            .css({ color: 'green' });
                    }
                    else {
                        alert("Loading Model is: " + status + "\nData: " + data);

                        $('#label-model')
                            .text("Upload failed")
                            .css({ color: 'red' });

                        $("#brain3d-icon-front").html("3D Brain");
                        $("#brain3d-icon-front").draggable("enable");
                    }
                });
        }

        reader.readAsText(file);
    }
});

$('#select-coords').button();
function uploadCoords() {
    var file = (<any>$('#select-coords').get(0)).files[0];
    if (file) {
        // 1. upload the file to server
        uploadTextFile(file, TYPE_COORD);

        // 2. also load data locally
        loadCoordinates(file);

        // 3. update file status
        changeFileStatus("coords-status", "uploaded");
        
    }
}

$('#select-matrix').button();
function uploadMatrix() {
    var file = (<any>$('#select-matrix').get(0)).files[0];
    if (file) {
        // 1. upload the file to server
        uploadTextFile(file, TYPE_MATRIX);

        // 2. also load data locally
        loadSimilarityMatrix(file, dataSet);

        // 3. update file status
        changeFileStatus("matrix-status", "uploaded");

    }
}

$('#select-attrs').button();
function uploadAttr() {
    var file = (<any>$('#select-attrs').get(0)).files[0];
    if (file) {
        // 1. upload the file to server
        uploadTextFile(file, TYPE_ATTR);

        // 2. also load data locally
        //loadAttributes(file, dataSet);
        var reader = new FileReader();
        reader.onload = function () {
            parseAttributes(reader.result, dataSet);

            // 3. update file status
            $('#attrs-status').removeClass('status-changed');
            $('#attrs-status').removeClass('glyphicon-info-sign');
            $('#attrs-status').addClass('status-updated');
            $('#attrs-status').addClass('glyphicon-ok-sign');
            document.getElementById("attrs-status").title = "Uploaded Succesfully";
            $("#attrs-status").tooltip('fixTitle');
            setupAttributeTab();
        }
        reader.readAsText(file);
    }
}

$('#select-labels').button();
function uploadLabels() {
    var file = (<any>$('#select-labels').get(0)).files[0];
    if (file) {
        // 1. upload the file to server
        uploadTextFile(file, TYPE_LABEL);

        // 2. also load data locally
        loadLabels(file);

        // 3. update file status
        changeFileStatus("labels-status", "uploaded");
        
    }
}

$(document).keyup(function (e) {
    if (e.keyCode == 27) toggleSplashPage();   // esc
});

function toggleSplashPage() {
    var splashPage = $('#splashPage');

    if (splashPage.hasClass("open")) {
        splashPage.removeClass("open");
        splashPage.addClass("close");

        setTimeout(function () {
            splashPage.removeClass("close");
        }, 500)
    } else {
        splashPage.addClass("open");
    }

}

function uploadTextFile(file, fileType: string) {
    var reader = new FileReader();

    reader.onload = function () {
        $.post("brain-app/upload.aspx",
            {
                fileText: reader.result,
                fileName: file.name,
                type: fileType
            },
            function (data, status) {
                if (status.toLowerCase() == "success") {
                    if (fileType == TYPE_COORD) {
                        saveObj.serverFileNameCoord = data;
                    }
                    else if (fileType == TYPE_MATRIX) {
                        saveObj.serverFileNameMatrix = data;
                    }
                    else if (fileType == TYPE_ATTR) {
                        saveObj.serverFileNameAttr = data;
                    }
                    else if (fileType == TYPE_LABEL) {
                        saveObj.serverFileNameLabel = data;
                    }
                }
                else {
                    //alert("Loading is: " + status + "\nData: " + data);
                }
            });
    }
    reader.readAsText(file);
}


$('#load-example-data').button().click(function () {
    loadExampleData(0, function (view) { });
});

function loadExampleData(view, func) {
    var status = {
        coordLoaded: false,
        matrixLoaded: false,
        attrLoaded: false,
        labelLoaded: false
    };

    var callback = function () {
        if (status.coordLoaded && status.matrixLoaded && status.attrLoaded && status.labelLoaded) {
            func(view);
        }
    }
    $.get('brain-app/data/coords.txt', function (text) {
        parseCoordinates(text);
        //$('#shared-coords').css({ color: 'green' });
        $('#label-coords')
            .text("default data")
            .css({ color: 'green' });
        status.coordLoaded = true;
         // change status
        document.getElementById("button-select-coords").innerHTML = "coords.txt";
        changeFileStatus("coords-status", "uploaded");

        callback();
    });
    $.get('brain-app/data/mat1.txt', function (text) {
        parseSimilarityMatrix(text, dataSet);
        //$('#d1-mat').css({ color: 'green' });
        $('#label-similarity-matrix')
            .text("default data")
            .css({ color: 'green' });
        status.matrixLoaded = true;

        // change status
        document.getElementById("button-select-matrix").innerHTML = "mat1.txt";
        changeFileStatus("matrix-status", "uploaded");

        callback();
    });
    $.get('brain-app/data/attributes1.txt', function (text) {
        parseAttributes(text, dataSet);
        //$('#d1-att').css({ color: 'green' });
        $('#label-attributes')
            .text("default data")
            .css({ color: 'green' });

        setupAttributeTab();
        status.attrLoaded = true;
        // change status
        document.getElementById("button-select-attrs").innerHTML = "attributes1.txt";
        changeFileStatus("attrs-status", "uploaded");

        callback();
    });
    $.get('brain-app/data/labels.txt', function (text) {
        parseLabels(text);
        //$('#shared-labels').css({ color: 'green' });
        $('#label-labels')
            .text("default data")
            .css({ color: 'green' });
        status.labelLoaded = true;

        // change status
        document.getElementById("button-select-labels").innerHTML = "labels.txt";
        changeFileStatus("labels-status", "uploaded");

        callback();
    });

    saveObj.loadExampleData = true;
}
function changeFileStatus(file, status) {
    $('#' + file).removeClass('status-changed');
    $('#' + file).removeClass('glyphicon-info-sign');
    $('#' + file).removeClass('status-updated');
    $('#' + file).removeClass('glyphicon-ok-sign');
 
    if (status === "changed") {
        $('#' + file).addClass('status-changed');
        $('#' + file).addClass('glyphicon-info-sign');
        document.getElementById(file).title = "File is not uploaded";

    } else {
        $('#' + file).addClass('status-updated');
        $('#' + file).addClass('glyphicon-ok-sign');
        document.getElementById(file).title = "Uploaded Succesfully";

    }
    $('#' + file).tooltip('fixTitle');

}
function loadUploadedData(loadObj, view, func, source = "save") {
    saveObj.loadExampleData = false;
    var status = {
        coordLoaded: false,
        matrixLoaded: false,
        attrLoaded: false,
        labelLoaded: (loadObj.serverFileNameLabel) ? false : true
    };

    var callback = function () {
        if (status.coordLoaded && status.matrixLoaded && status.attrLoaded && status.labelLoaded) {
            func(view);
        }
    }

    $.get('brain-app/' + source + '/' + loadObj.serverFileNameCoord, function (text) {
        parseCoordinates(text);
        //$('#shared-coords').css({ color: 'green' });
        $('#label-coords')
            .text("Pre-uploaded data")
            .css({ color: 'green' });
        status.coordLoaded = true;
        callback();
    });
    $.get('brain-app/' + source + '/' + loadObj.serverFileNameMatrix, function (text) {
        parseSimilarityMatrix(text, dataSet);
        //$('#d1-mat').css({ color: 'green' });
        $('#label-similarity-matrix')
            .text("Pre-uploaded data")
            .css({ color: 'green' });
        status.matrixLoaded = true;
        callback();
    });
    $.get('brain-app/' + source + '/' + loadObj.serverFileNameAttr, function (text) {
        parseAttributes(text, dataSet);
        //$('#d1-att').css({ color: 'green' });
        $('#label-attributes')
            .text("Pre-uploaded data")
            .css({ color: 'green' });
        setupAttributeTab();
        status.attrLoaded = true;
        callback()
    });
    // Check if Label file is uploaded
    if (loadObj.serverFileNameLabel) {
        $.get('brain-app/' + source + '/' + loadObj.serverFileNameLabel, function (text) {
            parseLabels(text);
            //$('#shared-labels').css({ color: 'green' });
            $('#label-labels')
                .text("Pre-uploaded data")
                .css({ color: 'green' });
        });
        status.labelLoaded = true;
        callback();
    }
    $('#load-example-data').button().prop("disabled", "disabled");

}

$('#button-apply-filter').button().click(applyFilterButtonOnClick);
$('#button-apply-filter').button("disable");



function setupAttributeTab() {
    if (dataSet.attributes) {
        $('#select-attribute').empty();
        for (var i = 0; i < dataSet.attributes.columnNames.length; ++i) {
            var columnName = dataSet.attributes.columnNames[i];
            $('#select-attribute').append('<option value = "' + columnName + '">' + columnName + '</option>');
        }

        $('#div-set-node-scale').show();

        $('#div-node-size').hide();
        $('#div-node-color-pickers').hide();
        $('#div-node-color-pickers-discrete').hide();

        $('#select-node-size-color').val('node-default');
        $('#select-attribute').prop("disabled", "disabled");

        setupCrossFilter(dataSet.attributes);
    }
}

function applyFilterButtonOnClick() {
    if (!dataSet.attributes.filteredRecords) {
        $('#button-apply-filter').button("disable");
        return;
    }

    var fRecords = dataSet.attributes.filteredRecords;
    var idArray = new Array();

    for (var i = 0; i < fRecords.length; ++i) {
        var id = fRecords[i]["index"];
        idArray.push(id);
    }

    if (apps[0]) apps[0].applyFilter(idArray);
    if (apps[1]) apps[1].applyFilter(idArray);
    if (apps[2]) apps[2].applyFilter(idArray);
    if (apps[3]) apps[3].applyFilter(idArray);

    saveObj.filteredRecords = dataSet.attributes.filteredRecords;
}

$('#button-set-node-size-color').button().click(function () {
    setNodeSizeOrColor();
});

function setSelectEdgeKeyBackgroundColor(color: string) {
    var keySelection = <any>document.getElementById('select-edge-key');
    keySelection.options[keySelection.selectedIndex].style.backgroundColor = '#' + color;
}

function setSelectNodeKeyBackgroundColor(color: string) {
    var keySelection = <any>document.getElementById('select-node-key');
    keySelection.options[keySelection.selectedIndex].style.backgroundColor = '#' + color;
}

function setDefaultEdgeDiscretizedValues() {
    //Assume data is shared across app
    var range = apps[0].getCurrentEdgeWeightRange();
    var numCategory = Number($('#select-edge-color-number-discretized-category').val());
    var step = (range.max - range.min) / numCategory;
    $('#input-edge-discretized-' + 0 + '-from').val(range.min);
    $('#input-edge-discretized-' + (numCategory - 1) + '-to').val(range.max);
    for (var i = 0; i < numCategory - 1; i++) {
        $('#input-edge-discretized-' + (i + 1) + '-from').val(range.min + step * (i + 1));
        $('#input-edge-discretized-' + i + '-to').val(range.min + step * (i + 1));
    }

}

function setEdgeDirectionGradient() {
    saveObj.edgeSettings.directionStartColor = $('#input-edge-start-color').val();
    saveObj.edgeSettings.directionEndColor = $('#input-edge-end-color').val();

    if (apps[0]) apps[0].setEdgeDirectionGradient();
    if (apps[1]) apps[1].setEdgeDirectionGradient();
    if (apps[2]) apps[2].setEdgeDirectionGradient();
    if (apps[3]) apps[3].setEdgeDirectionGradient();
}

function setEdgeColorByWeight() {

    var config = {};

    if (commonData.edgeWeightColorMode === "continuous-discretized") {
        var numCategory = Number($('#select-edge-color-number-discretized-category').val());

        var domainArray = [];
        var colorArray = [];
        var from = Number($('#input-edge-discretized-' + 0 + '-from').val());
        domainArray[domainArray.length] = from;
        for (var i = 0; i < numCategory; i++) {
            var to = Number($('#input-edge-discretized-' + i + '-to').val());
            domainArray[domainArray.length] = to;
            colorArray[colorArray.length] = "#" + $('#input-edge-discretized-' + i + '-color').val();
        }

        // save updated settings 
        saveObj.edgeSettings.colorBy = "weight";
        saveObj.edgeSettings.weight.type = "continuous-discretized";
        saveObj.edgeSettings.weight.discretizedSetting.numCategory = numCategory;
        saveObj.edgeSettings.weight.discretizedSetting.domainArray = domainArray;
        saveObj.edgeSettings.weight.discretizedSetting.colorArray = colorArray;

        // set config
        config["type"] = "continuous-discretized";
        config["domainArray"] = domainArray;
        config["colorArray"] = colorArray;

    } else if (commonData.edgeWeightColorMode === "continuous-normal") {
        var minColor = $('#input-edge-min-color').val();
        var maxColor = $('#input-edge-max-color').val();
        minColor = '#' + minColor;
        maxColor = '#' + maxColor;

        // save updated settings
        saveObj.edgeSettings.colorBy = "weight";
        saveObj.edgeSettings.weight.type = "continuous-normal";
        saveObj.edgeSettings.weight.continuousSetting.minColor = minColor;
        saveObj.edgeSettings.weight.continuousSetting.maxColor = maxColor;

        // set config
        config["type"] = "continuous-normal";
        config["minColor"] = minColor;
        config["maxColor"] = maxColor;

    } else if (commonData.edgeWeightColorMode === "discrete") {
        var valueArray = [];
        var colorArray = [];

        var keySelection = <any>document.getElementById('select-edge-key');

        for (var i = 0; i < keySelection.length; i++) {
            var key = keySelection.options[i].value;
            var color = keySelection.options[i].style.backgroundColor;
            var hex: string = colorToHex(color);
            valueArray.push(key);
            colorArray.push(hex);
        }

        // save updated settings
        saveObj.edgeSettings.colorBy = "weight";
        saveObj.edgeSettings.weight.type = "discrete";
        saveObj.edgeSettings.weight.discretizedSetting.domainArray = domainArray;
        saveObj.edgeSettings.weight.discretizedSetting.colorArray = colorArray;

        // set config
        config["type"] = "discrete";
        config["valueArray"] = valueArray;
        config["colorArray"] = colorArray;

    } else {
        console.log("Nothing is visible");
    }

    if (apps[0]) apps[0].setEdgeColorByWeight(config);
    if (apps[1]) apps[1].setEdgeColorByWeight(config);
    if (apps[2]) apps[2].setEdgeColorByWeight(config);
    if (apps[3]) apps[3].setEdgeColorByWeight(config);

}

function setEdgeColorByNode() {
    // save edge color setting
    saveObj.edgeSettings.colorBy = "node";

    if (apps[0]) apps[0].setEdgeColorByNode();
    if (apps[1]) apps[1].setEdgeColorByNode();
    if (apps[2]) apps[2].setEdgeColorByNode();
    if (apps[3]) apps[3].setEdgeColorByNode();
}

function setEdgeNoColor() {
    // save edge color setting 
    saveObj.edgeSettings.colorBy = "none";

    if (apps[0]) apps[0].setEdgeNoColor();
    if (apps[1]) apps[1].setEdgeNoColor();
    if (apps[2]) apps[2].setEdgeNoColor();
    if (apps[3]) apps[3].setEdgeNoColor();
}

function setNodeSizeOrColor() {
    var sizeOrColor = $('#select-node-size-color').val();
    var attribute = $('#select-attribute').val();
   

    if (!sizeOrColor || !attribute) return;

    if (sizeOrColor == "node-size") {
        var scaleArray = getNodeScaleArray(attribute);
        if (!scaleArray) return;

        var minScale = Math.min.apply(Math, scaleArray);
        var maxScale = Math.max.apply(Math, scaleArray);

        // Rescale the node based on the the size bar max and min values
        var values = $("#div-node-size-slider")['bootstrapSlider']().data('bootstrapSlider').getValue();
        var scaleMap = d3.scale.linear().domain([minScale, maxScale]).range([values[0], values[1]]);
        var newScaleArray = scaleArray.map((value: number) => { return scaleMap(value); });

        if (apps[0]) apps[0].setNodeSize(newScaleArray);
        if (apps[1]) apps[1].setNodeSize(newScaleArray);
        if (apps[2]) apps[2].setNodeSize(newScaleArray);
        if (apps[3]) apps[3].setNodeSize(newScaleArray);

        saveObj.nodeSettings.nodeSizeMin = values[0];
        saveObj.nodeSettings.nodeSizeMax = values[1];
        saveObj.nodeSettings.nodeSizeAttribute = attribute;
    }
    else if (sizeOrColor == "node-color") {
        var nodeColorMode = $('#checkbox-node-color-continuous').is(":checked");
        if (dataSet.attributes.info[attribute].isDiscrete  && !nodeColorMode) {
            var keyArray: number[] = [];
            var colorArray: string[] = [];

            var keySelection = <any>document.getElementById('select-node-key');

            for (var i = 0; i < keySelection.length; i++) {
                var key = keySelection.options[i].value;
                var color = keySelection.options[i].style.backgroundColor;
                var hex: string = colorToHex(color);
                keyArray.push(key);
                colorArray.push(hex);
            }
            saveObj.nodeSettings.nodeColorMode = "discrete";
            saveObj.nodeSettings.nodeColorDiscrete = colorArray.slice(0);


            if (apps[0]) apps[0].setNodeColorDiscrete(attribute, keyArray, colorArray);
            if (apps[1]) apps[1].setNodeColorDiscrete(attribute, keyArray, colorArray);
            if (apps[2]) apps[2].setNodeColorDiscrete(attribute, keyArray, colorArray);
            if (apps[3]) apps[3].setNodeColorDiscrete(attribute, keyArray, colorArray);
            
        }
        else {
            var minColor = $('#input-min-color').val();
            var maxColor = $('#input-max-color').val();

            minColor = '#' + minColor;
            maxColor = '#' + maxColor;

            if (apps[0]) apps[0].setNodeColor(attribute, minColor, maxColor);
            if (apps[1]) apps[1].setNodeColor(attribute, minColor, maxColor);
            if (apps[2]) apps[2].setNodeColor(attribute, minColor, maxColor);
            if (apps[3]) apps[3].setNodeColor(attribute, minColor, maxColor);
            
            saveObj.nodeSettings.nodeColorMode = "continuous";
            saveObj.nodeSettings.nodeColorContinuousMin = minColor;
            saveObj.nodeSettings.nodeColorContinuousMax = maxColor;
        }
        
        saveObj.nodeSettings.nodeColorAttribute = attribute;
    }
    else if (sizeOrColor == "node-default") {
        if (apps[0]) apps[0].setNodeDefaultSizeColor();
        if (apps[1]) apps[1].setNodeDefaultSizeColor();
        if (apps[2]) apps[2].setNodeDefaultSizeColor();
        if (apps[3]) apps[3].setNodeDefaultSizeColor();
    }

    saveObj.nodeSettings.nodeSizeOrColor = sizeOrColor;
}

function unique(sourceArray: any[]) {
    var arr = [];
    for (var i = 0; i < sourceArray.length; i++) {
        if (arr.indexOf(sourceArray[i]) == -1) {
            arr.push(sourceArray[i]);
        }
    }
    return arr;
}

$('#select-node-size-color').on('change', function () {
    selectNodeSizeColorOnChange();
});

function selectNodeSizeColorOnChange() {
    var value = $('#select-node-size-color').val();
    var attribute = $('#select-attribute').val();

    if (value == "node-default") {
        $('#select-attribute').prop("disabled", "disabled");

        $('#div-node-size').hide();
        $('#div-node-color-pickers').hide();
        $('#div-node-color-pickers-discrete').hide();
    }
    else if (value == "node-size") {
        $('#select-attribute').prop('disabled', false);
        $('#div-node-color-mode').hide();            

        setupNodeSizeRangeSlider(attribute);
    }
    else if (value == "node-color") {
        $('#select-attribute').prop('disabled', false);

        if (dataSet.attributes.info[attribute].isDiscrete) {
            $('#div-node-color-mode').show();
            setupColorPickerDiscrete(attribute);
        } else {
            $('#div-node-color-mode').hide();
            setupColorPicker();
        }
    }

    setNodeSizeOrColor();
}
$("#checkbox-node-color-continuous").on("change", function () {
    var attribute = $('#select-attribute').val();
    var nodeColorMode = $('#checkbox-node-color-continuous').is(":checked");
    if (!nodeColorMode && dataSet.attributes.info[attribute].isDiscrete) {
        setupColorPickerDiscrete(attribute);
    }
    else {
        setupColorPicker();
    }

    setNodeSizeOrColor();
});
$('#select-attribute').on('change', function () {
    var sizeOrColor = $('#select-node-size-color').val();
    var attribute = $('#select-attribute').val();
    
    if (sizeOrColor == "node-size") {
        setupNodeSizeRangeSlider(attribute);
    }
    if (sizeOrColor == "node-color") {
        if (dataSet.attributes.info[attribute].isDiscrete) {
            $('#div-node-color-mode').show();
            $('#checkbox-node-color-continuous').prop('checked', false);
            setupColorPickerDiscrete(attribute);
        }
        else {
            $('#div-node-color-mode').hide();
            setupColorPicker();
        }
    }

    setNodeSizeOrColor();
});

$('#select-node-key').on('change', function () {
    var key = $('#select-node-key').val();

    var keySelection = <any>document.getElementById('select-node-key');

    for (var i = 0; i < keySelection.length; i++) {
        if (keySelection.options[i].value == key) {
            var color = keySelection.options[i].style.backgroundColor;
            var hex = colorToHex(color);
            (<any>document.getElementById('input-node-color')).color.fromString(hex.substring(1));
            break;
        }
    }
});

$('#select-edge-key').on('change', function () {
    var key = $('#select-edge-key').val();

    var keySelection = <any>document.getElementById('select-edge-key');

    // find the coressponding key and retrieve color data
    for (var i = 0; i < keySelection.length; i++) {
        if (keySelection.options[i].value == key) {
            var color = keySelection.options[i].style.backgroundColor;
            var hex = colorToHex(color);
            (<any>document.getElementById('input-edge-color')).color.fromString(hex.substring(1));
            break;
        }
    }
});

///////////////////////////////////////////////////////////////////////////////////
//////////////// Function /////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
function loadSettings() {
    if (!(dataSet && dataSet.attributes && dataSet.brainCoords && dataSet.simMatrix)) {
        CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Dataset is required!");
        return;
    }

    var file = (<any>$('#input-select-load-file').get(0)).files[0];
    var reader = new FileReader();
    reader.onload = function () {
        loadObj = new SaveFile();
        loadObj.fromYaml(reader.result.toLowerCase());

        for (var i = 0; i < 4; i++) {
            if (!jQuery.isEmptyObject(loadObj.saveApps[i])) {
                initApp(i);
            }
        }
    }
    reader.readAsText(file);
}

function saveSettings() {
    var filename = "brain-model.cfg";
    var body = document.body;

    //Save all the apps
    for (var i = 0; i < 4; i++) {
        var app = saveObj.saveApps[i];
        if (apps[i]) apps[i].save(app);
    }

    var configText = saveObj.toYaml();

    var url = window["URL"].createObjectURL(new Blob([configText], { "type": "text\/xml" }));

    var a = document.createElement("a");
    body.appendChild(a);
    a.setAttribute("download", filename);
    a.setAttribute("href", url);
    a.style["display"] = "none";
    a.click();

    setTimeout(function () {
        window["URL"].revokeObjectURL(url);
    }, 10);
}


function exportSVG(viewport, type) {
    var documents = [window.document],
        SVGSources = [];

    // loop through all active app
    if (!apps[viewport]) return;

    var styles = getStyles(document);
    var newSource = getSource(viewport, styles);

    // Export all svg Graph on the page
    if (type === "svg") {
        downloadSVG(newSource);
    } else if (type === "image") {
        downloadSVGImage(newSource);
    }

}

function getSource(id, styles) {
    var svgInfo = {},
        svg = document.getElementById("svgGraph" + id);
    var doctype = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    var prefix = {
        xmlns: "http://www.w3.org/2000/xmlns/",
        xlink: "http://www.w3.org/1999/xlink",
        svg: "http://www.w3.org/2000/svg"
    };
    svg.setAttribute("version", "1.1");

    // insert 3D brain image
    // Remove old image if exists
    var oldImage = document.getElementById('brain3D' + id);
    if (oldImage) oldImage.parentNode.removeChild(oldImage);

    var canvas = apps[id].getDrawingCanvas();
    var image = document.createElement("image");
    svg.insertBefore(image, svg.firstChild);
    image.setAttribute('y', '0');
    image.setAttribute('x', '0');
    image.setAttribute('id', 'brain3D' + id);
    image.setAttribute('xlink:href', canvas.toDataURL());
    image.setAttribute('width', canvas.width);
    image.setAttribute('height', canvas.height);
    image.removeAttribute('xmlns');

    // insert defs
    var defsEl = document.createElement("defs");
    svg.insertBefore(defsEl, svg.firstChild); //TODO   .insert("defs", ":first-child")
    defsEl.setAttribute("class", "svg-crowbar");

    // insert styles to defs
    var styleEl = document.createElement("style")
    defsEl.appendChild(styleEl);
    styleEl.setAttribute("type", "text/css");


    // removing attributes so they aren't doubled up
    svg.removeAttribute("xmlns");
    svg.removeAttribute("xlink");

    // These are needed for the svg

    if (!svg.hasAttributeNS(prefix.xmlns, "xmlns:xlink")) {
        svg.setAttributeNS(prefix.xmlns, "xmlns:xlink", prefix.xlink);
    }



    var source = (new XMLSerializer()).serializeToString(svg).replace('</style>', '<![CDATA[' + styles + ']]></style>')
        .replace(/xmlns\=\"http\:\/\/www\.w3\.org\/1999\/xhtml\"/g, '');

    // Convert RGBA to RGB (for old Illustartor)
    source = source.replace(/rgba\((.+?)\, (.+?)\, (.+?)\,.+?\)/g, function (rgbaText) {
        var vals = /rgba\((.+?)\, (.+?)\, (.+?)\,.+?\)/i.exec(rgbaText);
        return "rgb(" + vals[1] + "," + vals[2] + "," + vals[3] + ")";
    });


    svgInfo = {
        id: svg.getAttribute("id"),
        childElementCount: svg.childElementCount,
        source: [doctype + source]
    };

    return svgInfo;
}

function downloadSVG(source) {
    var filename = "untitled";
    var body = document.body;

    if (source.id) {
        filename = source.id;
    } else if (source.class) {
        filename = source.class;
    } else if (window.document.title) {
        filename = window.document.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    }

    var url = window["URL"].createObjectURL(new Blob(source.source, { "type": "text\/xml" }));

    var a = document.createElement("a");
    body.appendChild(a);
    a.setAttribute("class", "svg-crowbar");
    a.setAttribute("download", filename + ".svg");
    a.setAttribute("href", url);
    a.style["display"] = "none";
    a.click();

    setTimeout(function () {
        window["URL"].revokeObjectURL(url);
    }, 10);
}
function downloadSVGImage(source) {
    var filename = "untitled";

    if (source.id) {
        filename = source.id;
    } else if (source.class) {
        filename = source.class;
    } else if (window.document.title) {
        filename = window.document.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    }

    var image = new Image();
    image.src = 'data:image/svg+xml;base64,' + window.btoa(extra.unescape(encodeURIComponent(source.source)))
    image.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        var context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);

        var a = document.createElement("a");
        a.setAttribute("download", filename + ".png");
        a.setAttribute("href", canvas.toDataURL('image/png'));
        a.click();
    }
}

function getStyles(doc) {
    var styles = "",
        styleSheets = doc.styleSheets;

    if (styleSheets) {
        for (var i = 0; i < styleSheets.length; i++) {
            processStyleSheet(styleSheets[i]);
        }
    }

    function processStyleSheet(ss) {
        if (ss.cssRules) {
            for (var i = 0; i < ss.cssRules.length; i++) {
                var rule = ss.cssRules[i];
                if (rule.type === 3) {
                    // Import Rule
                    processStyleSheet(rule.styleSheet);
                } else {
                    // hack for illustrator crashing on descendent selectors
                    if (rule.selectorText) {
                        if (rule.selectorText.indexOf(">") === -1) {
                            styles += "\n" + rule.cssText;
                        }
                    }
                }
            }
        }
    }
    return styles;
}

function colorToHex(color) {
    if (color.substr(0, 1) === '#') {
        return color;
    }
    var digits = /rgb\((\d+), (\d+), (\d+)\)/.exec(color);

    var red = parseInt(digits[1]);
    var green = parseInt(digits[2]);
    var blue = parseInt(digits[3]);

    var hexRed = red.toString(16);
    var hexGreen = green.toString(16);
    var hexBlue = blue.toString(16);

    if (hexRed.length == 1) hexRed = "0" + hexRed;
    if (hexGreen.length == 1) hexGreen = "0" + hexGreen;
    if (hexBlue.length == 1) hexBlue = "0" + hexBlue;

    return '#' + hexRed + hexGreen + hexBlue;
};

function getNodeScaleArray(attribute: string) {
    var attrArray = dataSet.attributes.get(attribute);

    var columnIndex = dataSet.attributes.columnNames.indexOf(attribute);

    // assume all positive numbers in the array
    var min = dataSet.attributes.getMin(columnIndex);
    var max = dataSet.attributes.getMax(columnIndex);

    var scaleArray: number[];
    //var scaleFactor = 0.5;
    var scaleFactor = 1;

    scaleArray = attrArray.map((value) => { return scaleFactor * value[0]; });

    return scaleArray;
}

function setupNodeSizeRangeSlider(attribute: string) {
    $('#div-node-color-pickers').hide();
    $('#div-node-color-pickers-discrete').hide();
    $("#div-node-size").show();

    var scaleArray = getNodeScaleArray(attribute);
    if (!scaleArray) return;
    
    var minScale = Math.min.apply(Math, scaleArray);
    var maxScale = Math.max.apply(Math, scaleArray);
    var slider = $("#div-node-size-slider")['bootstrapSlider']({
        range: true,
        min: 0.1,
        max: 10,
        step: 0.1,
        value: [minScale, maxScale],
        change: setNodeSizeOrColor,
    });
    slider.on("slide", () => {
        var values = $("#div-node-size-slider")['bootstrapSlider']().data('bootstrapSlider').getValue();
        $("#label_node_size_range").text(values[0] + " - " + values[1]);
        setNodeSizeOrColor();
    });
    slider.on("change", setNodeSizeOrColor);
    $("#label_node_size_range").text(minScale + " - " + maxScale);
}

function setupColorPicker() {
    $('#div-node-size').hide();
    $('#div-node-color-pickers-discrete').hide();
    $('#div-node-color-pickers').show();
}

function setupColorPickerDiscrete(attribute: string) {
    $('#div-node-size').hide();
    $('#div-node-color-pickers').hide();
    $('#div-node-color-pickers-discrete').show();

    var attrArray = dataSet.attributes.get(attribute);
    var uniqueKeys = dataSet.attributes.info[attribute].distinctValues;


    var d3ColorSelector = d3.scale.category20();

    var uniqueColors = uniqueKeys.map((group: number) => { return d3ColorSelector(group); });

    $('#select-node-key').empty();

    for (var i = 0; i < uniqueKeys.length; i++) {
        var option = document.createElement('option');
        option.text = uniqueKeys[i];
        option.value = uniqueKeys[i];
        option.style.backgroundColor = uniqueColors[i];
        $('#select-node-key').append(option);
    }

    (<any>document.getElementById('input-node-color')).color.fromString(uniqueColors[0].substring(1));
}

// Shorten the names of the views - they are referenced quite often
var tl_view = '#view-top-left';
var tr_view = '#view-top-right';
var bl_view = '#view-bottom-left';
var br_view = '#view-bottom-right';

// Create the object that the input target manager will use to update the pointer position when we're using the Leap
class PointerImageImpl {
    updatePosition(position) {
        $('#leap-pointer').offset({ left: position.x - 6, top: position.y - 6 });
    }
    show() {
        $('#leap-pointer').show();
    }
    hide() {
        $('#leap-pointer').hide();
    }
}

var pointerImage = new PointerImageImpl;

// Set up the class that will manage which view should be receiving input
var input = new InputTargetManager([tl_view, tr_view, bl_view, br_view], pointerImage);
input.setActiveTarget(0);

function getActiveTargetUnderMouse(x: number, y: number) {
    var id = -1;
    switch (getViewUnderMouse(x, y)) {
        case tl_view:
            id = 0;
            break;
        case tr_view:
            id = 1;
            break;
        case bl_view:
            id = 2;
            break;
        case br_view:
            id = 3;
            break;
    }
    return id;
}

function setNodeColorInContextMenu(color: string) {
    if (apps[input.activeTarget]) {
        if ((input.rightClickLabelAppended) && (input.selectedNodeID >= 0)) {
            apps[input.activeTarget].setANodeColor(input.selectedNodeID, '#' + color);
            input.contextMenuColorChanged = true;
        }
    }
}

function highlightSelectedNodes() {
    if (!dataSet || !dataSet.attributes) return;

    if (dataSet.attributes.filteredRecordsHighlightChanged) {
        dataSet.attributes.filteredRecordsHighlightChanged = false;

        if (!dataSet.attributes.filteredRecords) return;

        var fRecords = dataSet.attributes.filteredRecords;
        var idArray = new Array();

        // if all the nodes have been selected, cancel the highlight
        if (fRecords.length < dataSet.attributes.numRecords) {
            for (var i = 0; i < fRecords.length; ++i) {
                var id = fRecords[i]["index"];
                idArray.push(id);
            }
        }

        if (apps[0]) apps[0].highlightSelectedNodes(idArray);
        if (apps[1]) apps[1].highlightSelectedNodes(idArray);
        if (apps[2]) apps[2].highlightSelectedNodes(idArray);
        if (apps[3]) apps[3].highlightSelectedNodes(idArray);
    }
}

input.regMouseLocationCallback(getActiveTargetUnderMouse);
input.regMouseUpCallback(highlightSelectedNodes);

// Set up selectability
var selectTLView = function () {
    input.setActiveTarget(0);
    $(tl_view).css({ borderColor: 'black', zIndex: 1 });
    $(tr_view).css({ borderColor: 'white', zIndex: 0 });
    $(bl_view).css({ borderColor: 'white', zIndex: 0 });
    $(br_view).css({ borderColor: 'white', zIndex: 0 });
};
selectTLView(); // Select the top-left view straight away.
$(tl_view).click(selectTLView);
$(tr_view).click(function () {
    input.setActiveTarget(1);
    $(tl_view).css({ borderColor: 'white', zIndex: 0 });
    $(tr_view).css({ borderColor: 'black', zIndex: 1 });
    $(bl_view).css({ borderColor: 'white', zIndex: 0 });
    $(br_view).css({ borderColor: 'white', zIndex: 0 });
});
$(bl_view).click(function () {
    input.setActiveTarget(2);
    $(tl_view).css({ borderColor: 'white', zIndex: 0 });
    $(tr_view).css({ borderColor: 'white', zIndex: 0 });
    $(bl_view).css({ borderColor: 'black', zIndex: 1 });
    $(br_view).css({ borderColor: 'white', zIndex: 0 });
});
$(br_view).click(function () {
    input.setActiveTarget(3);
    $(tl_view).css({ borderColor: 'white', zIndex: 0 });
    $(tr_view).css({ borderColor: 'white', zIndex: 0 });
    $(bl_view).css({ borderColor: 'white', zIndex: 0 });
    $(br_view).css({ borderColor: 'black', zIndex: 1 });
});

// Set up icons

$('#brain3d-icon-front').draggable(
    <any>{
        containment: 'body',
        stop: function (event) {
            var model = $('#select-brain3d-model').val();
            var view = getViewUnderMouse(event.pageX, event.pageY);

            applyModelToBrainView(view, model);
        }
    }
);

function setBrainMode(brainMode, view: string) {
    switch (view) {
        case tl_view:
            apps[0].brainSurfaceMode = brainMode;
            break;
        case tr_view:
            apps[1].brainSurfaceMode = brainMode;
            break;
        case bl_view:
            apps[2].brainSurfaceMode = brainMode;
            break;
        case br_view:
            apps[3].brainSurfaceMode = brainMode;
            break;
    }
}


function viewToId(view: string): number {
    //TODO: this function should be used more in this class
    switch (view) {
        case tr_view: return 1;
        case bl_view: return 2;
        case br_view: return 0;
        default: return 0;      // tl_view
    }
}


function applyModelToBrainView(view: string, model: string, brainSurfaceMode?) {
    resetBrain3D();
    
    var file = (model === 'ch2') && 'BrainMesh_ch2.obj'
        || (model === 'ch2_inflated') && 'BrainMesh_Ch2_Inflated.obj'
        || (model === 'icbm') && 'BrainMesh_ICBM152.obj'
        || (model === 'ch2_cerebellum') && 'BrainMesh_Ch2withCerebellum.obj'
        || (model === 'upload') && (<any>$('#input-select-model').get(0)).files[0].name
        || "none";

    var id = viewToId(view);

    loadBrainModel(file, object => {
        $(view).empty();
        apps[id] = new Brain3DApp(
            {
                id,
                jDiv: $(view),
                brainModelOrigin: object,
                brainSurfaceMode
            },
            commonData,
            input.newTarget(id)
        );

        var app = saveObj.saveApps[id] = (loadObj && loadObj.saveApps[id]) || new SaveApp(); // create a new instance (if an old instance exists)
        app.surfaceModel = model;
        app.view = view;

        $('#button-save-app').button({ disabled: false });

        if (loadObj) {
            // Load dataset into the webapp
            if (loadObj.loadExampleData) {
                loadExampleData(app.setDataSetView, function (view) {
                    setDataset(view);
                    initApp(id)
                    CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS,
                        "Default example dataset is loaded.");
                });
            } else {
                var source = (saveObj.loadExampleData ? "save_examples" : "save");
                loadUploadedData(loadObj, app.setDataSetView, function (view) {
                    // Set data set to the right view
                    setDataset(view);
                    initApp(id);
                    CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS,
                        "Uploaded dataset is loaded.");
                }, source);
            }
        }
    });
}


$('#dataset1-icon-front').draggable(
    <any>{
        containment: 'body',
        stop: function (event) {
            var view = getViewUnderMouse(event.pageX, event.pageY);
            setDataset(view);
        }
    }
 );

function setDataset(view: string) {
    resetDataSetIcon();

    if (!dataSet) {
        loadExampleData(view, function (view) {
            var clonedDataSet = dataSet.clone();
            var appID = -1;
            switch (view) {
                case tl_view:
                    if (apps[0]) apps[0].setDataSet(clonedDataSet);
                    appID = 0;
                    break;
                case tr_view:
                    if (apps[1]) apps[1].setDataSet(clonedDataSet);
                    appID = 1;
                    break;
                case bl_view:
                    if (apps[2]) apps[2].setDataSet(clonedDataSet);
                    appID = 2;
                    break;
                case br_view:
                    if (apps[3]) apps[3].setDataSet(clonedDataSet);
                    appID = 3;
                    break;
            }

            if (appID != -1) {
                saveObj.saveApps[appID].setDataSetView = view;
            }
        });
    } else {
        if (!dataSet.verify()) return;
        var clonedDataSet = dataSet.clone();
        var appID = -1;
        switch (view) {
            case tl_view:
                if (apps[0]) apps[0].setDataSet(clonedDataSet);
                appID = 0;
                break;
            case tr_view:
                if (apps[1]) apps[1].setDataSet(clonedDataSet);
                appID = 1;
                break;
            case bl_view:
                if (apps[2]) apps[2].setDataSet(clonedDataSet);
                appID = 2;
                break;
            case br_view:
                if (apps[3]) apps[3].setDataSet(clonedDataSet);
                appID = 3;
                break;
        }

        if (appID != -1) {
            saveObj.saveApps[appID].setDataSetView = view;
        }
    
    }
}


$('#checkbox_yoking_view').on('change', function () {
    if ($('#checkbox_yoking_view').is(":checked")) {
        input.yokingView = true;
    }
    else {
        input.yokingView = false;
    }
});

$('#checkbox-thickness-by-weight').on('change', function () {
    if ($('#checkbox-thickness-by-weight').is(":checked")) {
        if (apps[0]) apps[0].setEdgeThicknessByWeight(true);
        if (apps[1]) apps[1].setEdgeThicknessByWeight(true);
        if (apps[2]) apps[2].setEdgeThicknessByWeight(true);
        if (apps[3]) apps[3].setEdgeThicknessByWeight(true);
    }
    else {
        if (apps[0]) apps[0].setEdgeThicknessByWeight(false);
        if (apps[1]) apps[1].setEdgeThicknessByWeight(false);
        if (apps[2]) apps[2].setEdgeThicknessByWeight(false);
        if (apps[3]) apps[3].setEdgeThicknessByWeight(false);
    }
});



$('#checkbox-edge-color-force-continuous').on('change', function () {
    if ($("#checkbox-edge-color-force-continuous").is(":checked")) {
        commonData.edgeForceContinuous = true;
    } else {
        commonData.edgeForceContinuous = false;
    }
    setEdgeColor();
});

$('#checkbox-edge-color-discretized').on('change', function () {
    if ($("#checkbox-edge-color-discretized").is(":checked")) {
        setDefaultEdgeDiscretizedValues();
        $("#div-edge-color-continuous-discretized").show();
        $("#div-edge-color-continuous-normal").hide();
        commonData.edgeWeightColorMode = "continuous-discretized";

        var numCategory = Number($('#select-edge-color-number-discretized-category').val());
        for (var i = 0; i < 5; i++) {
            if (i < numCategory) {
                $('#div-edge-discretized-' + i).show();
            } else {
                $('#div-edge-discretized-' + i).hide();
            }
        }
    } else {
        $("#div-edge-color-continuous-discretized").hide();
        $("#div-edge-color-continuous-normal").show();
        commonData.edgeWeightColorMode = "continuous-normal";
    }

    setEdgeColorByWeight();
});

$('#select-edge-direction').on('change', function () {
    saveObj.edgeSettings.directionMode = $('#select-edge-direction').val();
    setEdgeDirection();
});

$('#select-edge-color').on('change', function () {
    setEdgeColor();
});

$('#select-brain3d-model').on('change', function () {
    var model = $('#select-brain3d-model').val();

    if (model === "upload") {
        $("#div-upload-brain-model").show();
    } else {
        $("#div-upload-brain-model").hide();
    }

    resetBrain3D();

});

$('#select-edge-color-number-discretized-category').on('change', function () {
    var numCategory = Number($('#select-edge-color-number-discretized-category').val());

    setDefaultEdgeDiscretizedValues();
    for (var i = 0; i < 5; i++) {
        if (i < numCategory) {
            $('#div-edge-discretized-' + i).show();
        } else {
            $('#div-edge-discretized-' + i).hide();
        }
    }

    setEdgeColorByWeight();
});


$('#input-edge-discretized-' + 0 + '-from').on('change keyup paste', function () {
    setEdgeColorByWeight();
});

$('#input-edge-discretized-' + 4 + '-to').on('change keyup paste', function () {
    setEdgeColorByWeight();
});

$('#input-edge-discretized-1-from').on('change keyup paste', function () {
    var val = $('#input-edge-discretized-1-from').val();
    $('#input-edge-discretized-0-to').val(val);
    setEdgeColorByWeight();
});

$('#input-edge-discretized-2-from').on('change keyup paste', function () {
    var val = $('#input-edge-discretized-2-from').val();
    $('#input-edge-discretized-1-to').val(val);
    setEdgeColorByWeight();
});

$('#input-edge-discretized-3-from').on('change keyup paste', function () {
    var val = $('#input-edge-discretized-3-from').val();
    $('#input-edge-discretized-2-to').val(val);
    setEdgeColorByWeight();
});

$('#input-edge-discretized-4-from').on('change keyup paste', function () {
    var val = $('#input-edge-discretized-4-from').val();
    $('#input-edge-discretized-3-to').val(val);
    setEdgeColorByWeight();
});

$('#input-edge-discretized-0-to').on('change keyup paste', function () {
    var val = $('#input-edge-discretized-0-to').val();
    $('#input-edge-discretized-1-from').val(val);
    setEdgeColorByWeight();
});

$('#input-edge-discretized-1-to').on('change keyup paste', function () {
    var val = $('#input-edge-discretized-1-to').val();
    $('#input-edge-discretized-2-from').val(val);
    setEdgeColorByWeight();
});

$('#input-edge-discretized-2-to').on('change keyup paste', function () {
    var val = $('#input-edge-discretized-2-to').val();
    $('#input-edge-discretized-3-from').val(val);
    setEdgeColorByWeight();
});

$('#input-edge-discretized-3-to').on('change keyup paste', function () {
    var val = $('#input-edge-discretized-3-to').val();
    $('#input-edge-discretized-4-from').val(val);
    setEdgeColorByWeight();
});

function setEdgeDirection() {
    var value = $('#select-edge-direction').val();

    if (value === "gradient") {
        $("#div-edge-gradient-color-pickers").show();
    } else {
        $("#div-edge-gradient-color-pickers").hide();
    }

    if (apps[0]) apps[0].setEdgeDirection(value);
    if (apps[1]) apps[1].setEdgeDirection(value);
    if (apps[2]) apps[2].setEdgeDirection(value);
    if (apps[3]) apps[3].setEdgeDirection(value);
}

function setEdgeColor() {
    var value = $('#select-edge-color').val();

    if (value === "none") {
        setEdgeNoColor();
        commonData.edgeColorMode = "none";
        $("#div-edge-color-pickers").hide();

    } else if (value === "weight") {
        commonData.edgeColorMode = "weight";
        $("#div-edge-color-pickers").show();

        // check if discrete for all apps
        CommonUtilities.launchAlertMessage(CommonUtilities.alertType.WARNING, "Current version of application assumes all view port shares the same dataset");
        if (dataSet.info.edgeWeight.type === "continuous" || commonData.edgeForceContinuous) {
            if (dataSet.info.edgeWeight.type === "continuous") {
                $("#checkbox-edge-color-force-continuous").hide();
            }

            $("#div-edge-color-continuous").show();
            $("#div-edge-color-discrete").hide();

            if ($("#checkbox-edge-color-discretized").is(":checked")) {
                commonData.edgeWeightColorMode = "continuous-discretized";
                setDefaultEdgeDiscretizedValues();

                $("#div-edge-color-continuous-discretized").show();
                $("#div-edge-color-continuous-normal").hide();

                var numCategory = Number($('#select-edge-color-number-discretized-category').val());
                for (var i = 0; i < 5; i++) {
                    if (i < numCategory) {
                        $('#div-edge-discretized-' + i).show();
                    } else {
                        $('#div-edge-discretized-' + i).hide();
                    }
                }
            } else {
                commonData.edgeWeightColorMode = "continuous-normal";
                $("#div-edge-color-continuous-discretized").hide();
                $("#div-edge-color-continuous-normal").show();
            }
        } else if (dataSet.info.edgeWeight.type === "discrete") {
            // Enable force continuous checkbox
            $("#checkbox-edge-color-force-continuous").show();

            commonData.edgeWeightColorMode = "discrete";
            $("#div-edge-color-continuous").hide();
            $("#div-edge-color-discrete").show();

            var distinctValues = dataSet.info.edgeWeight.distincts;
            distinctValues.sort(function (a, b) { return a - b; });
            var d3ColorSelector = d3.scale.category20();
            var distinctColors = distinctValues.map((group: number) => { return d3ColorSelector(group); });
            $('#select-edge-key').empty();
            for (var i = 0; i < distinctValues.length; i++) {
                var option = document.createElement('option');
                option.text = distinctValues[i];
                option.value = distinctValues[i];
                option.style.backgroundColor = distinctColors[i];
                if (i == 0) {
                    var color = option.style.backgroundColor;
                    var hex = colorToHex(color);
                    (<any>document.getElementById('input-edge-color')).color.fromString(hex.substring(1));
                }
                $('#select-edge-key').append(option);
            }
        }

        setEdgeColorByWeight();
    } else if (value === "node") {
        setEdgeColorByNode();
        $("#div-edge-color-pickers").hide();
    }
}

// Move an icon back to its origin
function resetIcon(object: string, location: string) {
    return function () {
        var rect = $(location).get(0).getBoundingClientRect();
        $(object).css({ left: rect.left, top: rect.top });
    };
}

var resetBrain3D = resetIcon('#brain3d-icon-front', '#brain3d-icon-back');
var resetDataSetIcon = resetIcon('#dataset1-icon-front', '#dataset1-icon-back');


// Data set icons are visible when the page loads - reset them immediately
var visIcons = [$('#brain3d-icon-front')];

// These functions show and hide the icons for all the visualisations - they're called when we change tabs
function showVisIcons() {
    visIcons.forEach(function (icon) {
        icon.show();
    });
}
function hideVisIcons() {
    visIcons.forEach(function (icon) {
        icon.hide();
    });
}
//hideVisIcons(); // Hide all the icons immediately

// Reset all (surface tab) icons
resetBrain3D();
resetDataSetIcon();
showVisIcons();

var apps = Array<Application>(null, null, null, null);

// Initialize the view sizes and pin location
var viewWidth = $('#outer-view-panel').width();
var viewHeight = $('#outer-view-panel').height();
//$('#pin').css({ left: viewWidth / 2, top: viewHeight / 2 });
//setViewCrossroads(viewWidth / 2, viewHeight / 2);
var pinWidth = $('#pin').width();
var pinHeight = $('#pin').height();
$('#pin').css({ left: viewWidth - pinWidth, top: viewHeight - pinHeight });
setViewCrossroads(viewWidth - pinWidth, viewHeight - pinHeight);

// Set up the pin behaviour
$('#pin').draggable({ containment: '#outer-view-panel' }).on('drag', function (event: JQueryEventObject, ...args: any[]) {
    var ui = args[0];
    var x = ui.position.left;
    var y = ui.position.top;
    setViewCrossroads(x, y);
});

$("#div-surface-opacity-slider")['bootstrapSlider']({
    formatter: function (value) {
        return 'Current value: ' + value;
    }
});

$("#div-surface-opacity-slider")['bootstrapSlider']().on('slide', setSurfaceOpacity);

$("#div-edge-size-slider")['bootstrapSlider']({
    formatter: function (value) {
        return 'Current value: ' + value;
    }
});

$("#div-edge-size-slider")['bootstrapSlider']().on('slide', setEdgeSize);

/*
{
    min: 0.1,
    max: 3,
    step: 0.1,
    value: 1,
    change: setEdgeSize,
    slide: function (event, ui) {
        $("#label_edge_size").text(ui.value);
        setEdgeSize();
    }
}
*/
function setSurfaceOpacity() {
    var opacity = $("#div-surface-opacity-slider")['bootstrapSlider']().data('bootstrapSlider').getValue();
    saveObj.surfaceSettings.opacity = opacity;

    if (apps[0]) apps[0].setSurfaceOpacity(opacity);
    if (apps[1]) apps[1].setSurfaceOpacity(opacity);
    if (apps[2]) apps[2].setSurfaceOpacity(opacity);
    if (apps[3]) apps[3].setSurfaceOpacity(opacity);
}

function setEdgeSize() {
    var edgeSize = $("#div-edge-size-slider")['bootstrapSlider']().data('bootstrapSlider').getValue();
    saveObj.edgeSettings.size = edgeSize;


    if (apps[0]) apps[0].setEdgeSize(edgeSize);
    if (apps[1]) apps[1].setEdgeSize(edgeSize);
    if (apps[2]) apps[2].setEdgeSize(edgeSize);
    if (apps[3]) apps[3].setEdgeSize(edgeSize);
}

// Resizes the views such that the crossroads is located at (x, y) on the screen
function setViewCrossroads(x, y) {
    var viewWidth = $('#view-panel').width();
    var viewHeight = $('#view-panel').height();
    var lw = x - 1;
    var rw = viewWidth - x - 1;
    var th = y - 1;
    var bh = viewHeight - y - 1;
    $(tl_view).css({ width: lw, height: th });
    $(tr_view).css({ width: rw, height: th });
    $(bl_view).css({ width: lw, height: bh });
    $(br_view).css({ width: rw, height: bh });

    // Make callbacks to the application windows
    if (apps[0]) apps[0].resize(lw, th);
    if (apps[1]) apps[1].resize(rw, th);
    if (apps[2]) apps[2].resize(lw, bh);
    if (apps[3]) apps[3].resize(rw, bh);
}

window.addEventListener('resize', function () {
    var newViewWidth = $('#outer-view-panel').width();
    var newViewHeight = $('#outer-view-panel').height();
    var xScale = newViewWidth / viewWidth;
    var yScale = newViewHeight / viewHeight;
    var pinPos = $('#pin').position();
    var newPinX = pinPos.left * xScale;
    var newPinY = pinPos.top * yScale;

    $('#pin').css({ left: newPinX, top: newPinY });
    setViewCrossroads(newPinX, newPinY);

    viewWidth = newViewWidth;
    viewHeight = newViewHeight;
}, false);

// Find which view is currently located under the mouse
function getViewUnderMouse(x, y) {
    var innerViewLeft = $(tl_view).offset().left;
    if (x < innerViewLeft) {
        return null;
    } else {
        x -= innerViewLeft;
        if (y < $(tl_view).height()) {
            if (x < $(tl_view).width()) {
                return tl_view;
            } else {
                return tr_view;
            }
        } else {
            if (x < $(tl_view).width()) {
                return bl_view;
            } else {
                return br_view;
            }
        }
    }
}

// Resource loading
var commonData = new CommonData();
var dataSet: DataSet = null;

// Load the physiological coordinates of each node in the brain
function loadCoordinates(file) {
    var reader = new FileReader();
    reader.onload = function () {
        parseCoordinates(reader.result);
    }
    reader.readAsText(file);
}

function parseCoordinates(text: string) {

    if (!dataSet) dataSet = new DataSet();

    // For some reason the text file uses a carriage return to separate coordinates (ARGGgggh!!!!)
    //var lines = text.split(String.fromCharCode(13));
    var lines = text.replace(/\t|\,/g, ' ').trim().split(/\r\n|\r|\n/g).map(function (s) { return s.trim() });
    // check the last line:
    var lastline = lines[lines.length - 1].trim();
    if (lastline.length == 0) {
        lines.splice(lines.length - 1, 1); // remove last line
    }

    // Check if first line contains labels
    var firstWords = lines[0].split(' ');
    if (isNaN(Number(firstWords[0])) || isNaN(Number(firstWords[1])) || isNaN(Number(firstWords[2]))) {
        console.log("In Coordinate File: detect labels in the first line");
        lines.shift(); // remove if the first line is just labels
    }

    var len = lines.length;

    dataSet.brainCoords = [Array(len), Array(len), Array(len)];
    dataSet.info.nodeCount = len;
    for (var i = 0; i < len; ++i) {
        var words = lines[i].split(' ');
        // Translate the coords into Cola's format
        dataSet.brainCoords[0][i] = parseFloat(words[0]);
        dataSet.brainCoords[1][i] = parseFloat(words[1]);
        dataSet.brainCoords[2][i] = parseFloat(words[2]);
    }
    commonData.notifyCoords();
}

// Load the labels
function loadLabels(file) {
    var reader = new FileReader();
    reader.onload = function () {
        parseLabels(reader.result);
    }
    reader.readAsText(file);
}

function parseLabels(text: string) {
    if (!dataSet) dataSet = new DataSet();
    dataSet.brainLabels = text.replace(/\t|\n|\r/g, ' ').trim().split(' ').map(function (s) { return s.trim() });
    commonData.notifyLabels();
}

// Set up OBJ loading
var manager = new THREE.LoadingManager();
manager.onProgress = function (item, loaded, total) {
    console.log(item, loaded, total);
};

var loader = new (<any>THREE).OBJLoader(manager);

var brainSurfaceColor: string = "0xe3e3e3";

var saveObj = new SaveFile();
var loadObj: SaveFile;

var divLoadingNotification = document.createElement('div');
divLoadingNotification.id = 'div-loading-notification';



//-------------------------------------------------------------------------------------------------------------------------------------------
// functions

function initFromSaveFile() {
    var query = window.location.search.substring(1);
    if (query && query.length > 0) {
        showLoadingNotification();

        var p = query.split("=");
        if (p.length < 2) return false;

        var json;
        // Only let source be from "save_examples" (if specified by "example") or default to "save".
        var source = (p[0] == "example") ? "save_examples" : "save";
        $.post("brain-app/getapp.aspx",
            {
                filename: p[1],
                source
            },
            function (data, status) {
                if (status.toLowerCase() == "success") {
                    initProject(data, source);
                }
                else {
                    alert("Loading is: " + status + "\nData: " + data);
                }
            }
        );
        return true;
    } else {
        return false;
    }
}

function initProject(data: string, source = "save") {
    // Ensure that data is not empty
    if (!data || !data.length) return;

    loadObj = <SaveFile>jQuery.parseJSON(data);
    saveObj.loadExampleData = (source !== "save");
    
    for (var app of loadObj.saveApps) {
        if (app.surfaceModel && (app.surfaceModel.length > 0)) {
            applyModelToBrainView(app.view, app.surfaceModel, app.brainSurfaceMode);
        }
    }
}

function initApp(id) {

    // init edge count
    var app = loadObj.saveApps[id];
    if ((app.surfaceModel != null) && (app.surfaceModel.length > 0)) {
        apps[id].initEdgeCountSlider(app);
    }

    // init cross filter
    if ((loadObj.filteredRecords != null) && (loadObj.filteredRecords.length > 0)) {
        dataSet.attributes.filteredRecords = loadObj.filteredRecords.slice(0);
        applyFilterButtonOnClick();
    }

    // init show network
    if ((app.surfaceModel != null) && (app.surfaceModel.length > 0)) {
        apps[id].initShowNetwork(app);
    }


    // init the node size and color given the current UI. The UI needs to be redesigned.
    if ((loadObj.nodeSettings.nodeSizeOrColor != null) && (loadObj.nodeSettings.nodeSizeOrColor.length > 0)) {
        if (loadObj.nodeSettings.nodeSizeOrColor == "node-size") {
            initNodeColor();
            initNodeSize();
        }
        else if (loadObj.nodeSettings.nodeSizeOrColor == "node-color") {
            initNodeSize();
            initNodeColor();
        }
    }

    // init edge size and color.
    if (loadObj.edgeSettings != null) {
        initEdgeSizeAndColor();
    }

    // init Surface Setting
    if (loadObj.surfaceSettings != null) {
        initSurfaceSettings();
    }


    removeLoadingNotification();
}

function initSurfaceSettings() {
    if (loadObj.surfaceSettings.opacity) {
        $("#div-surface-opacity-slider")['bootstrapSlider']().data('bootstrapSlider').setValue(loadObj.surfaceSettings.opacity);
        setSurfaceOpacity();
    }
}

function initEdgeSizeAndColor() {

    $('select-edge-direction').val(loadObj.edgeSettings.directionMode);
    setEdgeDirection();

    if (loadObj.edgeSettings.colorBy === "none") {
        $('#select-edge-color').val("none");
        setEdgeColor();

    } else if (loadObj.edgeSettings.colorBy === "node") {
        $('#select-edge-color').val("node");
        setEdgeColor();

    } else if (loadObj.edgeSettings.colorBy === "weight") {
        $('#select-edge-color').val("weight");
        if (loadObj.edgeSettings.weight.type === "continuous-discretized") {
            $('#checkbox-edge-color-discretized').prop('checked', true);
        }

        // make all corresponding elements visible
        setEdgeColor();

        if (loadObj.edgeSettings.weight.type === "discrete") {
            var setting = loadObj.edgeSettings.weight.discreteSetting;
            var keySelection = <any>document.getElementById('select-edge-key');

            for (var i = 0; i < setting.valueArray; i++) {
                keySelection.options[i].style.backgroundColor = setting.colorArray[i];
            }

        } else if (loadObj.edgeSettings.weight.type === "continuous-normal") {
            var setting = loadObj.edgeSettings.weight.continuousSetting;

            $('#input-edge-min-color').val(setting.minColor.substring(1));
            $('#input-edge-max-color').val(setting.maxColor.substring(1));

        } else if (loadObj.edgeSettings.weight.type === "continuous-discretized") {
            var setting = loadObj.edgeSettings.weight.discretizedSetting;

            $('#select-edge-color-number-discretized-category').val(setting.numCategory);
            for (var i = 0; i < 5; i++) {
                if (i < setting.numCategory) {
                    $('#div-edge-discretized-' + i).show();
                } else {
                    $('#div-edge-discretized-' + i).hide();
                }
            }

            $('#input-edge-discretized-' + 0 + '-from').val(setting.domainArray[0]);
            $('#input-edge-discretized-' + (setting.numCategory - 1) + '-to')
                .val(setting.domainArray[setting.domainArray.length - 1]);
            for (var i = 0; i < setting.numCategory - 1; i++) {
                var value = setting.domainArray[i + 1];
                $('#input-edge-discretized-' + (i + 1) + '-from').val(value);
                $('#input-edge-discretized-' + i + '-to').val(value);
            }

            for (var i = 0; i < setting.numCategory; i++) {
                $('#input-edge-discretized-' + i + '-color')['colorpicker']('setValue', setting.colorArray[i]);
                (<any>document.getElementById('input-edge-discretized-' + i + '-color')).color.fromString(setting.colorArray[i].substring(1));
            }

        } else {
            throw "Load Data: Wrong data type setting for weight";
        }

        setEdgeColorByWeight();
    }
}

function initNodeSize() {
    if ((loadObj.nodeSettings.nodeSizeAttribute != null) && (loadObj.nodeSettings.nodeSizeAttribute.length > 0)) {
        $('#select-node-size-color').val("node-size");
        $('#select-attribute').val(loadObj.nodeSettings.nodeSizeAttribute);
        selectNodeSizeColorOnChange();

        $("#div-node-size-slider")['bootstrapSlider']().data('bootstrapSlider').setValue([loadObj.nodeSettings.nodeSizeMin, loadObj.nodeSettings.nodeSizeMax]);

        $("#label_node_size_range").text(loadObj.nodeSettings.nodeSizeMin + " - " + loadObj.nodeSettings.nodeSizeMax);

        setNodeSizeOrColor();
    }
}

function initNodeColor() {
    if ((loadObj.nodeSettings.nodeColorAttribute != null) && (loadObj.nodeSettings.nodeColorAttribute.length > 0)) {
        $('#select-node-size-color').val("node-color");
        $('#select-attribute').val(loadObj.nodeSettings.nodeColorAttribute);
        selectNodeSizeColorOnChange();

        if (dataSet.attributes.info[loadObj.nodeSettings.nodeColorAttribute].isDiscrete) {
            var keySelection = <any>document.getElementById('select-node-key');

            for (var i = 0; i < keySelection.length; i++) {
                keySelection.options[i].style.backgroundColor = loadObj.nodeSettings.nodeColorDiscrete[i];
            }

            (<any>document.getElementById('input-node-color')).color.fromString(loadObj.nodeSettings.nodeColorDiscrete[0].substring(1));

            setNodeSizeOrColor();
        }
        else {
            (<any>document.getElementById('input-min-color')).color.fromString(loadObj.nodeSettings.nodeColorContinuousMin.substring(1));
            (<any>document.getElementById('input-max-color')).color.fromString(loadObj.nodeSettings.nodeColorContinuousMax.substring(1));
            setNodeSizeOrColor();
        }
    }
}

function showLoadingNotification() {
    //console.log("function: cursorWait()");
    //$('body').css({ cursor: 'wait' });

    document.body.appendChild(divLoadingNotification);
    $('#div-loading-notification').empty(); // empty this.rightClickLabel

    divLoadingNotification.style.position = 'absolute';
    divLoadingNotification.style.left = '50%';
    divLoadingNotification.style.top = '50%';
    divLoadingNotification.style.padding = '5px';
    divLoadingNotification.style.borderRadius = '2px';
    divLoadingNotification.style.zIndex = '1';
    divLoadingNotification.style.backgroundColor = '#feeebd'; // the color of the control panel

    var text = document.createElement('div');
    text.innerHTML = "Loading...";
    divLoadingNotification.appendChild(text);

    //var button = document.createElement('button');
    //button.textContent = "continue";
    //divLoadingNotification.appendChild(button);
}

function removeLoadingNotification() {
    if ($('#div-loading-notification').length > 0)
        document.body.removeChild(divLoadingNotification);
}

// Load the brain surface (hardcoded - it is not simple to load geometry from the local machine, but this has not been deeply explored yet).
// NOTE: The loaded model cannot be used in more than one WebGL context (scene) at a time - the geometry and materials must be .cloned() into
// new THREE.Mesh() objects by the application wishing to use the model.
function loadBrainModel(file: string, callback) {
    loader.load('examples/graphdata/' + file, function (object) {
    //loader.setPath('examples/graphdata/');
    //loader.load(file, function (object) {
        if (!object) {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Failed to load brain surface.");
            return;
        }

        var surfaceColor = parseInt(brainSurfaceColor);

        callback(object);
    });
}

function setBrainSurfaceColor(color: string) {
    brainSurfaceColor = '0x' + color;
}

// Load the similarity matrix for the specified dataSet
function loadSimilarityMatrix(file, dataSet: DataSet) {
    var reader = new FileReader();
    reader.onload = function () {
        parseSimilarityMatrix(reader.result, dataSet);

    }
    reader.readAsText(file);
}

function parseSimilarityMatrix(text: string, dataSet: DataSet) {
    if (!dataSet) dataSet = new DataSet();
    //var lines = text.split('\n').map(function (s) { return s.trim() });
    var lines = text.replace(/\t|\,/g, ' ').trim().split(/\r\n|\r|\n/g).map(function (s) { return s.trim() });
    var simMatrix = [];
    lines.forEach((line, i) => {
        if (line.length > 0) {
            simMatrix.push(line.split(' ').map(function (string) {
                return parseFloat(string);
            }));
        }
    })
    dataSet.setSimMatrix(simMatrix);
}

// Load the attributes for the specified dataSet
function loadAttributes(file, dataSet: DataSet) {
    var reader = new FileReader();
    reader.onload = function () {
        parseAttributes(reader.result, dataSet);
    }
    reader.readAsText(file);
}

function parseAttributes(text: string, dataSet: DataSet) {
    if (!dataSet) dataSet = new DataSet();
    var newAttributes = new Attributes(text);
    dataSet.attributes = newAttributes;
    dataSet.notifyAttributes();
}

//var fcount = 0;
function setupCrossFilter(attrs: Attributes) {
    if (!attrs) return;

    // put attributes into an object array; round the attribute values for grouping in crossfilter
    var objectArray = new Array();
    for (var i = 0; i < attrs.numRecords; ++i) {
        // create an object for each record:
        var object = new Object();
        object["index"] = i;

        for (var j = 0; j < attrs.columnNames.length; ++j) {
            //object[attrs.columnNames[j]] = attrs.getValue(attrs.columnNames[j], i);

            var attrValue: number;
            if (j == 1) {
                attrValue = attrs.getValue(j, i)[0];
            }
            else if (j == 3) {
                attrValue = attrs.getValue(j, i)[0];
                attrValue = Math.round(attrValue / 20) * 20;
            }
            else {
                attrValue = attrs.getValue(j, i)[0];
                attrValue = parseFloat(attrValue.toFixed(2));
            }

            object[attrs.columnNames[j]] = attrValue;

        }

        objectArray.push(object);
    }

    // convert the object array to json format
    var json = JSON.parse(JSON.stringify(objectArray));
    //console.log(json);

    // create crossfilter
    var cfilter = crossfilter(json);
    var totalReadings = cfilter.size();
    var all = cfilter.groupAll();

    var dimArray = new Array();

    // create a data count widget
    // once created data count widget will automatically update the text content of the following elements under the parent element.
    // ".total-count" - total number of records
    // ".filter-count" - number of records matched by the current filters
    dc.dataCount(".dc-data-count")
        .dimension(cfilter)
        .group(all);
    // create the charts 
    for (var j = 0; j < attrs.columnNames.length; ++j) {
        $('#barCharts').append('<div id="barChart' + j + '"></div>');
        var chart = dc.barChart("#barChart" + j);

        var columnName = attrs.columnNames[j];
        var minValue = attrs.getMin(j);
        var maxValue = attrs.getMax(j);
        var offset = (maxValue - minValue) * 0.1;

        var dim = cfilter.dimension(function (d) { return d[columnName]; });
        dimArray.push(dim);
        var group = dim.group().reduceCount(function (d) { return d[columnName]; });

        chart
            .gap(5)
            .width(270)
            .height(150)
            .dimension(dim)
            .group(group)
            .x(d3.scale.linear().domain([minValue - offset, maxValue + offset]))
            .xAxisLabel(columnName)
            .xUnits(function () { return 25; })
            .centerBar(true)
            .on("filtered", filtered)
            .xAxis().ticks(6);


    }

    // keep track of total readings
    d3.select("#total").text(totalReadings);

    // listener
    function filtered() {
        //console.log("filter event...");

        dataSet.attributes.filteredRecords = dimArray[0].top(Number.POSITIVE_INFINITY);
        dataSet.attributes.filteredRecordsHighlightChanged = true;
        //console.log(dimArray);
        if (dataSet.attributes.filteredRecords) {
            //console.log(fcount + "). count: " + dataSet.attributes.filteredRecords.length);
            //fcount++; 
        }
        
        $('#button-apply-filter').button("enable");
    }

    $('#button-apply-filter').button("disable");

    // render all charts
    dc.renderAll();
}


//////////////////////////////////////////////////////////////////
///                  On Default                                 //
//////////////////////////////////////////////////////////////////

function defaultFunction() {
    var gotSave = initFromSaveFile();
    if (!gotSave) {
        applyModelToBrainView(tl_view, $('#select-brain3d-model').val());
        toggleSplashPage();
    }
}