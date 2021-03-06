﻿/*
    All classes responsible for the application state, i.e. the "source of truth" go here.
*/


// Holds data common to all datasets, and sends notifications when data changes
class CommonData {

    public selectedNode = -1;
    public nodeIDUnderPointer: number[] = [-1, -1, -1, -1, -1]; // for yoked display; the last one is for svg graphs
    public circularBar1ColorPicker;
    public circularBar2ColorPicker;

    public edgeColorMode = "none";
    public edgeWeightColorMode = "";
    public edgeForceContinuous = false;
    //public edgeColorByNodeTransition = false;
    //public edgeColorByNodeTransitionColor = "#ee2211";

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
    public simMatrix: number[][] = [];
    public brainCoords: number[][] = [[]];
    public brainLabels: string[] = [];
    public attributes = new Attributes();
    public info;
    public sortedSimilarities = [];
    simCallback: () => void;
    attCallback: () => void;

    constructor() {

        this.info = {
            nodeCount: 0,
            edgeWeight: {
                type: "",
                distincts: []
            },
            isSymmetricalMatrix: true
        };
    }

    verify() {
        // Give a boolean result that indicates whether there is enough data to produce an interactive model.
        // Note that incomplete data will sometimes be progressively loaded, so error alerts should be less
        // dramatic and more informative in these cases.

        if (!this.brainCoords[0].length) {
            // Can't do much, but empty data is still technically OK
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.INFO, "Node coordinates are empty. Load a valid coordinates file.");
            return true;
        }

        let isValid = true;

        if (this.brainCoords[0].length !== this.attributes.numRecords) {
            if (!this.attributes.numRecords) {
                CommonUtilities.launchAlertMessage(CommonUtilities.alertType.INFO, "Attributes are empty. Load a valid attributes file.");
            }
            else {
                CommonUtilities.launchAlertMessage(
                    CommonUtilities.alertType.ERROR, `Attribute and coordinate files do not match! (${this.attributes.numRecords} attributes for ${this.brainCoords[0].length} columns)`
                );
            }
            isValid = false;
        }

        if (this.brainCoords[0].length !== this.simMatrix.length) {
            if (!this.simMatrix.length) {
                CommonUtilities.launchAlertMessage(CommonUtilities.alertType.INFO, "Similarity matrix is empty. Load a valid matrix file.");
            }
            else {
                CommonUtilities.launchAlertMessage(
                    CommonUtilities.alertType.ERROR, `Similarity matrix and coordinates files do not match! (lengths ${this.brainCoords[0].length} and ${this.simMatrix.length})`
                );
            }
            isValid = false;
        }

        return isValid;
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
        this.info.isSymmetricalMatrix = CommonUtilities.isSymmetrical(this.simMatrix);

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
        this.simCallback = callback;
    }
    regNotifyAttributes(callback: () => void) {
        this.attCallback = callback;
    }
    // TODO: add deregistration capability
    notifySim() {
        if (this.simCallback) this.simCallback();
    }
    notifyAttributes() {
        if (this.attCallback) this.attCallback();
    }
}

class SaveFile {
    // user-uploaded file names
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


    constructor(sourceObject) {
        
        this.edgeSettings = (sourceObject && sourceObject.edgeSettings) || {
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
            },
            edgeColorByNodeTransition: false,
            edgeColorByNodeTransitionColor: "#ee2211"
        };

        this.nodeSettings = (sourceObject && sourceObject.nodeSettings) || {
            nodeSizeOrColor: '',
            nodeSizeAttribute: '',
            nodeSizeMin: 1,
            nodeSizeMax: 2,
            nodeColorAttribute: '',
            nodeColorMode: "discrete",
            nodeColorDiscrete: ["#1f77b4", "#a2b0e8", "#ff7f0e", "#fffb87", "#2ca02c"],
            nodeColorContinuousMin: '',
            nodeColorContinuousMax: ''
        };

        this.surfaceSettings = (sourceObject && sourceObject.surfaceSettings) || {
            opacity: 0.5
        };
        let saveApps = (sourceObject && sourceObject.saveApps) || [];
        this.saveApps = saveApps
            .filter(d => !!d)       // Some save files have null instead of apps
            .map(d => new SaveApp(d))
            ;
        
        if (sourceObject) {
            if (sourceObject.serverFileNameCoord) this.serverFileNameCoord = sourceObject.serverFileNameCoord;
            if (sourceObject.serverFileNameMatrix) this.serverFileNameMatrix = sourceObject.serverFileNameMatrix;
            if (sourceObject.serverFileNameAttr) this.serverFileNameAttr = sourceObject.serverFileNameAttr;
            if (sourceObject.serverFileNameLabel) this.serverFileNameLabel = sourceObject.serverFileNameLabel;

            if (sourceObject.filteredRecords) this.serverFileNameCoord = sourceObject.filteredRecords;
        }
    }


    // Use the hardcoded example data iff the minimal required source files aren't specified.
    useExampleData = () => !this.serverFileNameCoord || !this.serverFileNameMatrix || !this.serverFileNameAttr;


    toYaml() {

        var yamlObj = {};
        
        yamlObj["Edge Settings"] = {
            "Colour By": this.edgeSettings.colorBy,
            "Size": this.edgeSettings.size
        };

        if (this.edgeSettings.colorBy === "weight") {
            yamlObj["Edge Settings"]["Weight"] = {
                "Type": this.edgeSettings.weight.type
            }
            if (this.edgeSettings.weight.type === "discrete") {
                yamlObj["Edge Settings"]["Weight"]["Colour List"] = this.edgeSettings.weight.discreteSetting.colorArray;
                yamlObj["Edge Settings"]["Weight"]["Value List"] = this.edgeSettings.weight.discreteSetting.valueArray;
            } else if (this.edgeSettings.weight.type === "continuous-discretized") {
                yamlObj["Edge Settings"]["Weight"]["Number of Category"] = this.edgeSettings.weight.discretizedSetting.numCategory;
                yamlObj["Edge Settings"]["Weight"]["Domain List"] = this.edgeSettings.weight.discretizedSetting.domainArray;
                yamlObj["Edge Settings"]["Weight"]["Colour List"] = this.edgeSettings.weight.discretizedSetting.colorArray;
            } else if (this.edgeSettings.weight.type === "continuous-normal") {
                yamlObj["Edge Settings"]["Weight"]["Max Value Colour"] = this.edgeSettings.weight.continuousSetting.maxColor;
                yamlObj["Edge Settings"]["Weight"]["Min Value Colour"] = this.edgeSettings.weight.continuousSetting.minColor;
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

        //TODO: Restore when multiple views is reimplemented
        //for (let i in this.saveApps) {
        //    yamlObj["viewport" + i] = this.saveApps[i].toYaml();
        //}
        yamlObj["viewport0"] = this.saveApps[0].toYaml();
        
        return jsyaml.safeDump(yamlObj);
    }

    fromYaml(yaml) {
        var yamlObj = jsyaml.safeLoad(yaml);
        
        this.edgeSettings.colorBy = yamlObj["edge settings"]["colour by"];
        this.edgeSettings.size = yamlObj["edge settings"]["size"];

        if (this.edgeSettings.colorBy === "weight") {
            this.edgeSettings.weight.type = yamlObj["edge settings"]["weight"]["type"];

            if (this.edgeSettings.weight.type === "discrete") {
                this.edgeSettings.weight.discreteSetting.colorArray = yamlObj["edge settings"]["weight"]["colour list"];
                this.edgeSettings.weight.discreteSetting.valueArray = yamlObj["edge settings"]["weight"]["value list"];
            } else if (this.edgeSettings.weight.type === "continuous-discretized") {
                this.edgeSettings.weight.discretizedSetting.numCategory = yamlObj["edge settings"]["weight"]["number of category"];
                this.edgeSettings.weight.discretizedSetting.domainArray = yamlObj["edge settings"]["weight"]["domain list"];
                this.edgeSettings.weight.discretizedSetting.colorArray = yamlObj["edge settings"]["weight"]["colour list"];
            } else if (this.edgeSettings.weight.type === "continuous-normal") {
                this.edgeSettings.weight.continuousSetting.maxColor = yamlObj["edge settings"]["weight"]["max value colour"];
                this.edgeSettings.weight.continuousSetting.minColor = yamlObj["edge settings"]["weight"]["min value colour"];
            }
        }

        this.nodeSettings = {
            nodeSizeOrColor: "node-color",
            nodeSizeAttribute: yamlObj["node settings"]["size attribute"],
            nodeSizeMin: yamlObj["node settings"]["max size"],
            nodeSizeMax: yamlObj["node settings"]["min size"],

            nodeColorAttribute: yamlObj["node settings"]["colour attribute"],
            nodeColorContinuousMin: yamlObj["node settings"]["continuous colour min"],
            nodeColorContinuousMax: yamlObj["node settings"]["continuous colour max"],
            nodeColorDiscrete: yamlObj["node settings"]["discrete colour list"]
        };

        this.surfaceSettings.opacity = yamlObj["brain settings"]["transparency"];

        //TODO: restore this when reinstating multiple viewports
        /*
        for (var i = 0; i < 4; i++) {
            if (yamlObj["viewport" + i]) {
                this.saveApps[i] = new SaveApp({});
                this.saveApps[i].fromYaml(yamlObj["viewport" + i]);
            }
        }
        */
        if (yamlObj["viewport0"]) {
            this.saveApps[0] = new SaveApp({});
            this.saveApps[0].fromYaml(yamlObj["viewport0"]);
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
    //setDataSetView: string;

    // determine edgeCount setting
    edgeCount: number;

    // which network is open
    showingTopologyNetwork: boolean;
    networkType: string;

    // extra option for circular layout:
    circularBundleAttribute: string;
    circularSortAttribute: string;
    circularLabelAttribute: string;
    circularEdgeGradient: boolean;
    circularAttributeBars;

    // Options for 2D layout
    layout2d: string;
    bundle2d: string;
    scale2d: number;

    constructor(sourceObject) {
        this.surfaceModel = (sourceObject && sourceObject.surfaceModel) || "";
        this.brainSurfaceMode = (sourceObject && sourceObject.brainSurfaceMode) || "";
        this.view = (sourceObject && sourceObject.view) || TL_VIEW;
        this.dataSet = (sourceObject && sourceObject.dataSet) || new DataSet();
        //this.setDataSetView = (sourceObject && sourceObject.setDataSetView) || "";
        this.edgeCount = (sourceObject && sourceObject.edgeCount) || 20;
        this.showingTopologyNetwork = (sourceObject && sourceObject.showingTopologyNetwork) || false;
        this.networkType = (sourceObject && sourceObject.networkType && sourceObject.networkType.toLowerCase()) || "";
        this.circularBundleAttribute = (sourceObject && sourceObject.circularBundleAttribute) || "";
        this.circularSortAttribute = (sourceObject && sourceObject.circularSortAttribute) || "";
        this.circularLabelAttribute = (sourceObject && sourceObject.circularLabelAttribute) || "";
        this.circularEdgeGradient = (sourceObject && sourceObject.circularEdgeGradient) || false;
        this.circularAttributeBars = (sourceObject && sourceObject.circularAttributeBars) || "";
        this.layout2d = (sourceObject && sourceObject.layout2d) || "cola";
        this.bundle2d = (sourceObject && sourceObject.bundle2d) || "none";
        this.scale2d = (sourceObject && sourceObject.scale2d) || 5;
    }


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
                "Label Attribute": this.circularLabelAttribute,
                "Attribute Bars": this.circularAttributeBars
            }
        }
        else if (this.networkType === "2d") {
            yamlObj["2d settings"] = {
                "layout": this.layout2d,
                "bundle attribute": this.bundle2d,
                "scale": this.scale2d
            }
        };

        return yamlObj;
    }

    fromYaml(yamlObj) {
        this.surfaceModel = yamlObj["surface model"];
        this.edgeCount = yamlObj["number of edges"];
        this.brainSurfaceMode = yamlObj["brain surface mode"];
        this.showingTopologyNetwork = (yamlObj["show graph"] === "yes");
        this.networkType = yamlObj["network type"];

        if (this.networkType === "circular") {
            this.circularBundleAttribute = yamlObj["circular settings"]["bundle attribute"];
            this.circularSortAttribute = yamlObj["circular settings"]["sort attribute"];
            this.circularLabelAttribute = yamlObj["circular settings"]["label attribute"];
            this.circularAttributeBars = yamlObj["circular settings"]["attribute bars"];
        }
        else if (this.networkType === "2d") {
            this.layout2d = yamlObj["2d settings"]["layout"];
            this.bundle2d = yamlObj["2d settings"]["bundle attribute"];
            this.scale2d = yamlObj["2d settings"]["scale"];
        };
    }
}

// Parses, stores, and provides access to brain node attributes from a file
class Attributes {
    attrValues: number[][][];
    columnNames: string[] = [];
    numRecords: number = 0;
    info = {};

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

