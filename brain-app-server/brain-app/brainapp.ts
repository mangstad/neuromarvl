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


const TYPE_COORD = "coordinates";
const TYPE_MATRIX = "matrix";
const TYPE_ATTR = "attributes";
const TYPE_LABEL = "labels";

// The names of the views are referenced quite often
const TL_VIEW = '#view-top-left';
const TR_VIEW = '#view-top-right';
const BL_VIEW = '#view-bottom-left';
const BR_VIEW = '#view-bottom-right';


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
    setSurfaceColor(color: string);

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


class NeuroMarvl {
    referenceDataSet = new DataSet();
    commonData = new CommonData();
    brainSurfaceColor: string;
    saveObj = new SaveFile({});
    loader;     // THREE.ObjLoader
    apps: Brain3DApp[];

    pointerImage = new PointerImageImpl;

    viewWidth = 0;
    viewHeight = 0;
    pinWidth = 0;
    pinHeight = 0;

    // UI elements
    divLoadingNotification;

    input: InputTargetManager;


    constructor() {
        this.brainSurfaceColor = "0xe3e3e3";

        // Set up OBJ loading
        let manager = new THREE.LoadingManager();
        this.loader = new (<any>THREE).OBJLoader(manager);
        
        this.apps = Array<Brain3DApp>();

        // Set up the class that will manage which view should be receiving input
        this.input = new InputTargetManager([TL_VIEW, TR_VIEW, BL_VIEW, BR_VIEW], this.pointerImage);
        this.input.setActiveTarget(0);
    }


    /*
        Functions to create a solid starting state and all UI elements available
    */

    initUI = () => {
        // Initialise the view sizes and pin location
        this.viewWidth = $('#outer-view-panel').width();
        this.viewHeight = $('#outer-view-panel').height();
        this.pinWidth = $('#pin').width();
        this.pinHeight = $('#pin').height();

        // Data set icons are visible when the page loads - reset them immediately
        // Load notification
        this.divLoadingNotification = document.createElement('div');
        this.divLoadingNotification.id = 'div-loading-notification';

        /* 
            Set up jQuery UI layout objects
        */
        if ($("#checkbox-tips").is(":checked")) {
            $("[data-toggle='tooltip']").tooltip(<any>{ container: 'body', trigger: 'hover' });
        }
        else {
            $("[data-toggle='tooltip']").tooltip("destroy");
        }
        
        /*
            Upload files buttons
        */
        $('#button-select-coords').click(() => $("#select-coords").click());
        $('#select-coords').on('change', () => {
            // Change the button name according to the file name
            var file = (<any>$('#select-coords').get(0)).files[0];
            document.getElementById("button-select-coords-filename").innerHTML = file.name;

            this.changeFileStatus("coords-status", "changed");

            // parse and upload coordinate file
            this.uploadCoords();
        });

        $('#button-select-matrices-batching').click(() => {
            $("#select-matrices-batching").click();
        });
        $("#select-matrices-batching").on('change', () => {
            var numFiles = (<any>$('#select-matrices-batching').get(0)).files.length;
            document.getElementById("button-select-matrices-batching").innerHTML = numFiles + " files loaded";
            
            this.changeFileStatus("matrices-batching-status", "uploaded");
        });
        $('#button-select-attrs-batching').click(() => {
            $("#select-attrs-batching").click();
        });
        $("#select-attrs-batching").on('change', () => {
            var numFiles = (<any>$('#select-attrs-batching').get(0)).files.length;
            document.getElementById("button-select-attrs-batching").innerHTML = numFiles + " files loaded";

            this.changeFileStatus("attrs-batching-status", "uploaded");
        });

        $('#btn-start-batching').click(() => {
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

                this.batchProcess(i, numberOfFiles, attributes, matrices);

            } else {
                CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Number of Files do not match.");
            }

        });


        $('#pin').css({ left: this.viewWidth - this.pinWidth, top: this.viewHeight - this.pinHeight });
        this.setViewCrossroads(this.viewWidth - this.pinWidth, this.viewHeight - this.pinHeight);

        // Set up the pin behaviour
        $('#pin').draggable({ containment: '#outer-view-panel' }).on('drag', (event: JQueryEventObject, ...args: any[]) => {
            let ui = args[0];
            let x = ui.position.left;
            let y = ui.position.top;
            this.setViewCrossroads(x, y);
        });

        $("#div-surface-opacity-slider")['bootstrapSlider']({
            formatter: value => 'Current value: ' + value
        });

        $("#div-surface-opacity-slider")['bootstrapSlider']().on('slide', this.setSurfaceOpacity);

        $("#div-edge-size-slider")['bootstrapSlider']({
            formatter: value => 'Current value: ' + value
        });

        $("#div-edge-size-slider")['bootstrapSlider']().on('slide', this.setEdgeSize);
        
        $('#input-select-model').button();
        $('#select-coords').button();
        $('#select-matrix').button();
        $('#select-attrs').button();
        $('#select-labels').button();

        $("#overlay-close").click(this.toggleSplashPage);
        $("#control-panel-bottom-close").click(this.toggleSplashPage);

        // Create colour pickers
        (<any>$("#input-node-color")).colorpicker({ format: "hex" });
        (<any>$("#input-surface-color")).colorpicker({ format: "hex" });
        (<any>$("#input-min-color")).colorpicker({ format: "hex" });
        (<any>$("#input-max-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-start-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-end-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-discretized-0-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-discretized-1-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-discretized-2-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-discretized-3-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-discretized-4-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-min-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-max-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-color")).colorpicker({ format: "hex" });
        (<any>$("#input-context-menu-node-color")).colorpicker({ format: "hex" });
        (<any>$("#input-edge-transitional-color")).colorpicker({ format: "hex" });
    }

    start = () => {
        this.initUI();

        let query = window.location.search.substring(1);
        
        let commonInit = () => {
            this.initDataDependantUI();
            this.initListeners();
        }

        let callbackNoSave = () => {
            this.createBrainView(TL_VIEW, $('#select-brain3d-model').val(), commonInit, "empty");
            this.toggleSplashPage();
        };

        if (query && query.length > 0) {
            this.showLoadingNotification();

            var p = query.split("=");
            if (p.length < 2) return false;

            var json;
            // Only let source be from "save_examples" (if specified by "example") or default to "save".
            let source = p[0];      // "save" or "example"
            $.post("brain-app/getapp.aspx",
                {
                    filename: p[1],
                    source
                },
                (data, status) => {
                    console.log(`Data fetch from ${p[0]} location got configuration with length ${data.length} and "${status}" status`);
                    if (status.toLowerCase() == "success") {
                        // Ensure that data is not empty
                        if (!data || !data.length) return;

                        this.saveObj = new SaveFile(jQuery.parseJSON(data));
                        for (var app of this.saveObj.saveApps) {
                            if (app.surfaceModel && (app.surfaceModel.length > 0)) {
                                this.createBrainView(app.view, app.surfaceModel, commonInit, source, app.brainSurfaceMode);
                            }
                        }
                    }
                    else {
                        alert("Loading is: " + status + "\nData: " + data);
                        callbackNoSave();
                    }
                }
            );
        } else {
            callbackNoSave();
        }
    }


    /*
        Functions to work with app state
    */

    initApp = id => {
        // init edge count
        var app = this.saveObj.saveApps[id];
        if (app.surfaceModel) {
            this.apps[id].initEdgeCountSlider(app);
        }

        // init cross filter
        if (this.saveObj.filteredRecords && (this.saveObj.filteredRecords.length > 0)) {
            this.referenceDataSet.attributes.filteredRecords = this.saveObj.filteredRecords.slice(0);
            this.applyFilterButtonOnClick();
        }

        // make sure the app has required graphs created
        this.apps[id].restart();

        // init show network
        if (app.surfaceModel) {
            this.apps[id].initShowNetwork(app);
        }

        this.removeLoadingNotification();
    }

    initDataDependantUI = () => {
        // init the node size and colour given the current UI. The UI needs to be redesigned.
        if (this.saveObj.nodeSettings.nodeSizeOrColor && (this.saveObj.nodeSettings.nodeSizeOrColor.length > 0)) {
            if (this.saveObj.nodeSettings.nodeSizeOrColor == "node-size") {
                this.initNodeColor();
                this.initNodeSize();
            }
            else if (this.saveObj.nodeSettings.nodeSizeOrColor == "node-color") {
                this.initNodeSize();
                this.initNodeColor();
            }
        }

        // init edge size and colour.
        if (this.saveObj.edgeSettings) {
            this.initEdgeSizeAndColor();
        }

        // init Surface Setting
        if (this.saveObj.surfaceSettings) {
            this.initSurfaceSettings();
        }

        this.selectView(TL_VIEW);
    }

    
    batchProcess = (i, numberOfFiles, attributes, matrices) => {
        document.getElementById("alertModalMessage").innerHTML = "Started load of " + numberOfFiles + " file pairs...";

        let gotAttributes = false;
        let gotMatrix = false;
        let onLoaded = (i, numberOfFiles, attributes, matrices) => {
            if (!gotAttributes || !gotMatrix) return;
            
            // Load the new dataset to the app (always use the first viewport - top left);
            this.setDataset(TL_VIEW);

            // refresh the visualisation with current settings and new data
            this.apps[0].showNetwork(false, () => {
                this.setNodeSizeOrColor();
                this.setEdgeColor();
                this.apps[0].update(0);

                // Capture and download the visualisation
                this.exportSVG(0, "svg");

                // update status
                i++;
                var percentage = (i / numberOfFiles) * 100;
                $("#progressBar").css({
                    "width": percentage + "%"
                });
                document.getElementById("alertModalMessage").innerHTML = "Processing " + (i + 1) + " in " + numberOfFiles + " pairs.";

                if (i < numberOfFiles) {
                    this.batchProcess(i, numberOfFiles, attributes, matrices);
                } else {
                    $("#alertModal")["modal"]('hide');
                }
            });
        };
        
        // Load pair of files into dataset
        this.loadAttributes(attributes[i], this.referenceDataSet, () => {
            gotAttributes = true;
            onLoaded(i, numberOfFiles, attributes, matrices);
        });
        this.loadSimilarityMatrix(matrices[i], this.referenceDataSet, () => {
            gotMatrix = true;
            onLoaded(i, numberOfFiles, attributes, matrices);
        });
    }


    uploadCoords = () => {
        var file = (<any>$('#select-coords').get(0)).files[0];
        if (file) {
            // 1. upload the file to server
            this.uploadTextFile(file, TYPE_COORD);

            // 2. also load data locally
            this.loadCoordinates(file);

            // 3. update file status
            this.changeFileStatus("coords-status", "uploaded");
        }
    }

    uploadMatrix = () => {
        var file = (<any>$('#select-matrix').get(0)).files[0];
        if (file) {
            // 1. upload the file to server
            this.uploadTextFile(file, TYPE_MATRIX);

            // 2. also load data locally
            this.loadSimilarityMatrix(file, this.referenceDataSet);

            // 3. update file status
            this.changeFileStatus("matrix-status", "uploaded");

        }
    }

    uploadAttr = () => {
        var file = (<any>$('#select-attrs').get(0)).files[0];
        if (file) {
            // 1. upload the file to server
            this. uploadTextFile(file, TYPE_ATTR);

            // 2. also load data locally
            //loadAttributes(file, dataSet);
            var reader = new FileReader();
            reader.onload = () => {
                this.parseAttributes(reader.result, this.referenceDataSet);
                this.referenceDataSet.notifyAttributes();

                // 3. update file status
                $('#attrs-status').removeClass('status-changed');
                $('#attrs-status').removeClass('glyphicon-info-sign');
                $('#attrs-status').addClass('status-updated');
                $('#attrs-status').addClass('glyphicon-ok-sign');
                document.getElementById("attrs-status").title = "Uploaded Succesfully";
                $("#attrs-status").tooltip('fixTitle');
                this.setupAttributeTab();
            }
            reader.readAsText(file);
        }
    }

    uploadLabels = () => {
        var file = (<any>$('#select-labels').get(0)).files[0];
        if (file) {
            // 1. upload the file to server
            this.uploadTextFile(file, TYPE_LABEL);

            // 2. also load data locally
            this.loadLabels(file);

            // 3. update file status
            this.changeFileStatus("labels-status", "uploaded");
        }
    }

    toggleSplashPage = () => {
        var splashPage = $('#splashPage');

        if (splashPage.hasClass("open")) {
            splashPage.removeClass("open");
            splashPage.addClass("close");

            setTimeout(() => splashPage.removeClass("close"), 500)
        } else {
            splashPage.addClass("open");
        }

    }

    uploadTextFile = (file, fileType: string) => {
        var reader = new FileReader();

        reader.onload = () => {
            $.post("brain-app/upload.aspx",
                {
                    fileText: reader.result,
                    fileName: file.name,
                    type: fileType
                },
                (data, status) => {
                    if (status.toLowerCase() == "success") {
                        if (fileType == TYPE_COORD) {
                            this.saveObj.serverFileNameCoord = data;
                        }
                        else if (fileType == TYPE_MATRIX) {
                            this.saveObj.serverFileNameMatrix = data;
                        }
                        else if (fileType == TYPE_ATTR) {
                            this.saveObj.serverFileNameAttr = data;
                        }
                        else if (fileType == TYPE_LABEL) {
                            this.saveObj.serverFileNameLabel = data;
                        }
                    }
                    else {
                        //alert("Loading is: " + status + "\nData: " + data);
                    }
                });
        }
        reader.readAsText(file);
    }
    
    loadExampleData = func => {
        var status = {
            coordLoaded: false,
            matrixLoaded: false,
            attrLoaded: false,
            labelLoaded: false
        };

        CommonUtilities.launchAlertMessage(CommonUtilities.alertType.INFO, "Loading default data...");

        var callback = () => {
            if (status.coordLoaded && status.matrixLoaded && status.attrLoaded && status.labelLoaded) {
                CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS, "Default data loaded");
                this.commonData.notifyCoords();
                this.referenceDataSet.notifyAttributes();
                this.commonData.notifyLabels();
                func();
            }
        }
        $.get('brain-app/data/coords.txt', text => {
            this.parseCoordinates(text);
            //$('#shared-coords').css({ color: 'green' });
            $('#label-coords')
                .text("default data")
                .css({ color: 'green' });
            status.coordLoaded = true;
            // change status
            document.getElementById("button-select-coords-filename").innerHTML = "coords.txt";
            this.changeFileStatus("coords-status", "uploaded");

            callback();
        });
        $.get('brain-app/data/mat1.txt', text => {
            this.parseSimilarityMatrix(text, this.referenceDataSet);
            //$('#d1-mat').css({ color: 'green' });
            $('#label-similarity-matrix')
                .text("default data")
                .css({ color: 'green' });
            status.matrixLoaded = true;

            // change status
            document.getElementById("button-select-matrix-filename").innerHTML = "mat1.txt";
            this.changeFileStatus("matrix-status", "uploaded");

            callback();
        });
        $.get('brain-app/data/attributes1.txt', text => {
            this.parseAttributes(text, this.referenceDataSet);
            //$('#d1-att').css({ color: 'green' });
            $('#label-attributes')
                .text("default data")
                .css({ color: 'green' });

            this.setupAttributeTab();
            status.attrLoaded = true;
            // change status
            document.getElementById("button-select-attrs-filename").innerHTML = "attributes1.txt";
            this.changeFileStatus("attrs-status", "uploaded");

            callback();
        });
        $.get('brain-app/data/labels.txt', text => {
            this.parseLabels(text);
            //$('#shared-labels').css({ color: 'green' });
            $('#label-labels')
                .text("default data")
                .css({ color: 'green' });
            status.labelLoaded = true;

            // change status
            document.getElementById("button-select-labels-filename").innerHTML = "labels.txt";
            this.changeFileStatus("labels-status", "uploaded");

            callback();
        });
    }

    changeFileStatus = (file, status) => {
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
    
    loadUploadedData = (saveObj, func, source?: string) => {
        var status = {
            coordLoaded: false,
            matrixLoaded: false,
            attrLoaded: false,
            labelLoaded: (saveObj.serverFileNameLabel) ? false : true
        };

        let sourceLocation = (source === "example") ? "save_examples" : "save";
        
        var callback = () => {
            if (status.coordLoaded && status.matrixLoaded && status.attrLoaded && status.labelLoaded) {
                this.commonData.notifyCoords();
                this.referenceDataSet.notifyAttributes();
                this.commonData.notifyLabels();
                func();
            }
        }

        $.get('brain-app/' + sourceLocation + '/' + saveObj.serverFileNameCoord, text => {
            this.parseCoordinates(text);
            $('#label-coords')
                .text("Pre-uploaded data")
                .css({ color: 'green' });
            status.coordLoaded = true;
            // change status
            document.getElementById("button-select-coords-filename").innerHTML = saveObj.serverFileNameCoord;
            this.changeFileStatus("coords-status", "uploaded");

            callback();
        });
        $.get('brain-app/' + sourceLocation + '/' + saveObj.serverFileNameMatrix, text => {
            this.parseSimilarityMatrix(text, this.referenceDataSet);
            $('#label-similarity-matrix')
                .text("Pre-uploaded data")
                .css({ color: 'green' });
            status.matrixLoaded = true;

            // change status
            document.getElementById("button-select-matrix-filename").innerHTML = saveObj.serverFileNameMatrix;
            this.changeFileStatus("matrix-status", "uploaded");

            callback();
        });
        $.get('brain-app/' + sourceLocation + '/' + saveObj.serverFileNameAttr, text => {
            this.parseAttributes(text, this.referenceDataSet);
            //$('#d1-att').css({ color: 'green' });
            $('#label-attributes')
                .text("Pre-uploaded data")
                .css({ color: 'green' });
            this.setupAttributeTab();
            status.attrLoaded = true;
            // change status
            document.getElementById("button-select-attrs-filename").innerHTML = saveObj.serverFileNameAttr;
            this.changeFileStatus("attrs-status", "uploaded");

            callback()
        });
        // Check if Label file is uploaded
        if (saveObj.serverFileNameLabel) {
            $.get('brain-app/' + sourceLocation + '/' + saveObj.serverFileNameLabel, text => {
                this.parseLabels(text);
                //$('#shared-labels').css({ color: 'green' });
                $('#label-labels')
                    .text("Pre-uploaded data")
                    .css({ color: 'green' });

                status.labelLoaded = true;

                // change status
                document.getElementById("button-select-labels-filename").innerHTML = saveObj.serverFileNameLabel;
                this.changeFileStatus("labels-status", "uploaded");

                callback();
            });
        }
        else {
            status.labelLoaded = true;
            callback();
        }
        $('#load-example-data').button().prop("disabled", "disabled");

    }


    setupAttributeNodeControls = () => {
        let sizeOrColor = $('#select-node-size-color').val();
        let attribute = $('#select-attribute').val();

        if (sizeOrColor == "node-size") {
            this.setupNodeSizeRangeSlider(attribute);
        }
        if (sizeOrColor == "node-color") {
            if (this.referenceDataSet.attributes.info[attribute].isDiscrete) {
                $('#div-node-color-mode').show();
                $('#checkbox-node-color-continuous').prop('checked', false);
                this.setupColorPickerDiscrete(attribute);
            }
            else {
                $('#div-node-color-mode').hide();
                this.setupColorPicker();
            }
        }

        this.setNodeSizeOrColor();
    }


    setupAttributeTab = () => {
        if (this.referenceDataSet && this.referenceDataSet.attributes) {

            let $selectAttribute = $('#select-attribute');

            let oldAttributeValue = $selectAttribute.val();
            let gotOldValue = false;

            $selectAttribute.empty();
            for (var i = 0; i < this.referenceDataSet.attributes.columnNames.length; ++i) {
                var columnName = this.referenceDataSet.attributes.columnNames[i];
                $selectAttribute.append('<option value = "' + columnName + '">' + columnName + '</option>');
                if (columnName === oldAttributeValue) gotOldValue = true;
            }
            if (gotOldValue) $selectAttribute.val(oldAttributeValue);

            $('#div-set-node-scale').show();
            
            this.setupAttributeNodeControls();
            
            this.setupCrossFilter(this.referenceDataSet.attributes);
        }
    }

    applyFilterButtonOnClick = () => {
        if (!this.referenceDataSet.attributes.filteredRecords) {
            $('#button-apply-filter').button("disable");
            return;
        }

        var fRecords = this.referenceDataSet.attributes.filteredRecords;
        var idArray = new Array();

        for (var i = 0; i < fRecords.length; ++i) {
            var id = fRecords[i]["index"];
            idArray.push(id);
        }
        
        this.apps.forEach(app => {
            app.applyFilter(idArray);
            app.needUpdate = true;
        });

        this.saveObj.filteredRecords = this.referenceDataSet.attributes.filteredRecords;
    }

    setSelectEdgeKeyBackgroundColor = (color: string) => {
        if (color.length === 6) color = "#" + color; 
        var keySelection = <any>document.getElementById('select-edge-key');
        keySelection.options[keySelection.selectedIndex].style.backgroundColor = color;
    }

    setSelectNodeKeyBackgroundColor = (color: string) => {
        if (color.length === 6) color = "#" + color; 
        var keySelection = <any>document.getElementById('select-node-key');
        keySelection.options[keySelection.selectedIndex].style.backgroundColor = color;
    }

    setDefaultEdgeDiscretizedValues = () => {
        //Assume data is shared across app
        var range = this.apps[0].getCurrentEdgeWeightRange();
        var numCategory = Number($('#select-edge-color-number-discretized-category').val());
        var step = (range.max - range.min) / numCategory;
        $('#input-edge-discretized-' + 0 + '-from').val(range.min.toString());
        $('#input-edge-discretized-' + (numCategory - 1) + '-to').val(range.max.toString());
        for (var i = 0; i < numCategory - 1; i++) {
            $('#input-edge-discretized-' + (i + 1) + '-from').val((range.min + step * (i + 1)).toString());
            $('#input-edge-discretized-' + i + '-to').val((range.min + step * (i + 1)).toString());
        }
    }

    setEdgeDirectionGradient = () => {
        this.saveObj.edgeSettings.directionStartColor = (<any>$('#input-edge-start-color')).colorpicker("getValue");
        this.saveObj.edgeSettings.directionEndColor = (<any>$('#input-edge-end-color')).colorpicker("getValue");

        if (this.apps[0]) this.apps[0].setEdgeDirectionGradient();
        if (this.apps[1]) this.apps[1].setEdgeDirectionGradient();
        if (this.apps[2]) this.apps[2].setEdgeDirectionGradient();
        if (this.apps[3]) this.apps[3].setEdgeDirectionGradient();
    }

    setEdgeColorByWeight = () => {

        var config = {};

        if (this.commonData.edgeWeightColorMode === "continuous-discretized") {
            var numCategory = Number($('#select-edge-color-number-discretized-category').val());

            var domainArray = [];
            var colorArray = [];
            var from = Number($('#input-edge-discretized-' + 0 + '-from').val());
            domainArray[domainArray.length] = from;
            for (var i = 0; i < numCategory; i++) {
                var to = Number($('#input-edge-discretized-' + i + '-to').val());
                domainArray[domainArray.length] = to;
                colorArray[colorArray.length] = (<any>$('#input-edge-discretized-' + i + '-color')).colorpicker("getValue");
            }

            // save updated settings 
            this.saveObj.edgeSettings.colorBy = "weight";
            this.saveObj.edgeSettings.weight.type = "continuous-discretized";
            this.saveObj.edgeSettings.weight.discretizedSetting.numCategory = numCategory;
            this.saveObj.edgeSettings.weight.discretizedSetting.domainArray = domainArray;
            this.saveObj.edgeSettings.weight.discretizedSetting.colorArray = colorArray;

            // set config
            config["type"] = "continuous-discretized";
            config["domainArray"] = domainArray;
            config["colorArray"] = colorArray;

        } else if (this.commonData.edgeWeightColorMode === "continuous-normal") {
            var minColor = (<any>$('#input-edge-min-color')).colorpicker("getValue");
            var maxColor = (<any>$('#input-edge-max-color')).colorpicker("getValue");

            // save updated settings
            this.saveObj.edgeSettings.colorBy = "weight";
            this.saveObj.edgeSettings.weight.type = "continuous-normal";
            this.saveObj.edgeSettings.weight.continuousSetting.minColor = minColor;
            this.saveObj.edgeSettings.weight.continuousSetting.maxColor = maxColor;

            // set config
            config["type"] = "continuous-normal";
            config["minColor"] = minColor;
            config["maxColor"] = maxColor;

        } else if (this.commonData.edgeWeightColorMode === "discrete") {
            var valueArray = [];
            var colorArray = [];

            var keySelection = <any>document.getElementById('select-edge-key');

            for (var i = 0; i < keySelection.length; i++) {
                var key = keySelection.options[i].value;
                var color = keySelection.options[i].style.backgroundColor;
                var hex: string = this.colorToHex(color);
                valueArray.push(key);
                colorArray.push(hex);
            }

            // save updated settings
            this.saveObj.edgeSettings.colorBy = "weight";
            this.saveObj.edgeSettings.weight.type = "discrete";
            this.saveObj.edgeSettings.weight.discretizedSetting.domainArray = domainArray;
            this.saveObj.edgeSettings.weight.discretizedSetting.colorArray = colorArray;

            // set config
            config["type"] = "discrete";
            config["valueArray"] = valueArray;
            config["colorArray"] = colorArray;

        } else {
            console.log("Nothing is visible");
        }

        if (this.apps[0]) this.apps[0].setEdgeColorByWeight(config);
        if (this.apps[1]) this.apps[1].setEdgeColorByWeight(config);
        if (this.apps[2]) this.apps[2].setEdgeColorByWeight(config);
        if (this.apps[3]) this.apps[3].setEdgeColorByWeight(config);

    }

    setEdgeColorByNode = () => {
        // save edge colour setting
        this.saveObj.edgeSettings.colorBy = "node";

        if (this.apps[0]) this.apps[0].setEdgeColorByNode();
        if (this.apps[1]) this.apps[1].setEdgeColorByNode();
        if (this.apps[2]) this.apps[2].setEdgeColorByNode();
        if (this.apps[3]) this.apps[3].setEdgeColorByNode();
    }

    setEdgeNoColor = () => {
        // save edge colour setting 
        this.saveObj.edgeSettings.colorBy = "none";

        if (this.apps[0]) this.apps[0].setEdgeNoColor();
        if (this.apps[1]) this.apps[1].setEdgeNoColor();
        if (this.apps[2]) this.apps[2].setEdgeNoColor();
        if (this.apps[3]) this.apps[3].setEdgeNoColor();
    }

    selectView = view => {
        this.input.setActiveTarget(this.viewToId(view));
        $(TL_VIEW).css({ borderColor: 'white', zIndex: 0 });
        $(TR_VIEW).css({ borderColor: 'white', zIndex: 0 });
        $(BL_VIEW).css({ borderColor: 'white', zIndex: 0 });
        $(BR_VIEW).css({ borderColor: 'white', zIndex: 0 });
        $(view).css({ borderColor: 'black', zIndex: 1 });
    }

    setNodeSizeOrColor = () => {
        var sizeOrColor = $('#select-node-size-color').val();
        var attribute = $('#select-attribute').val();

        if (!sizeOrColor || !attribute) return;

        if (sizeOrColor == "node-size") {
            var scaleArray = this.getNodeScaleArray(attribute);
            if (!scaleArray) return;

            var minScale = Math.min.apply(Math, scaleArray);
            var maxScale = Math.max.apply(Math, scaleArray);

            // Rescale the node based on the the size bar max and min values
            var values = $("#div-node-size-slider")['bootstrapSlider']().data('bootstrapSlider').getValue();
            var scaleMap = d3.scale.linear().domain([minScale, maxScale]).range([values[0], values[1]]);
            var newScaleArray = scaleArray.map((value: number) => { return scaleMap(value); });

            if (this.apps[0]) this.apps[0].setNodeSize(newScaleArray);
            if (this.apps[1]) this.apps[1].setNodeSize(newScaleArray);
            if (this.apps[2]) this.apps[2].setNodeSize(newScaleArray);
            if (this.apps[3]) this.apps[3].setNodeSize(newScaleArray);
            
            this.saveObj.nodeSettings.nodeSizeMin = values[0];
            this.saveObj.nodeSettings.nodeSizeMax = values[1];
            this.saveObj.nodeSettings.nodeSizeAttribute = attribute;
        }
        else if (sizeOrColor == "node-color") {
            var nodeColorMode = $('#checkbox-node-color-continuous').is(":checked");
            if (this.referenceDataSet.attributes.info[attribute].isDiscrete && !nodeColorMode) {
                var keyArray: number[] = [];
                var colorArray: string[] = [];

                var keySelection = <any>document.getElementById('select-node-key');

                for (var i = 0; i < keySelection.length; i++) {
                    //var key = keySelection.options[i].value;
                    var key = parseInt(keySelection.options[i].value);
                    var color = keySelection.options[i].style.backgroundColor;
                    var hex: string = this.colorToHex(color);
                    keyArray.push(key);
                    colorArray.push(hex);
                }
                this.saveObj.nodeSettings.nodeColorMode = "discrete";
                this.saveObj.nodeSettings.nodeColorDiscrete = colorArray.slice(0);
                
                if (this.apps[0]) this.apps[0].setNodeColorDiscrete(attribute, keyArray, colorArray);
                if (this.apps[1]) this.apps[1].setNodeColorDiscrete(attribute, keyArray, colorArray);
                if (this.apps[2]) this.apps[2].setNodeColorDiscrete(attribute, keyArray, colorArray);
                if (this.apps[3]) this.apps[3].setNodeColorDiscrete(attribute, keyArray, colorArray);
            }
            else {
                let minColor = (<any>$('#input-min-color')).colorpicker("getValue");
                let maxColor = (<any>$('#input-max-color')).colorpicker("getValue");

                if (this.apps[0]) this.apps[0].setNodeColor(attribute, minColor, maxColor);
                if (this.apps[1]) this.apps[1].setNodeColor(attribute, minColor, maxColor);
                if (this.apps[2]) this.apps[2].setNodeColor(attribute, minColor, maxColor);
                if (this.apps[3]) this.apps[3].setNodeColor(attribute, minColor, maxColor);

                this.saveObj.nodeSettings.nodeColorMode = "continuous";
                this.saveObj.nodeSettings.nodeColorContinuousMin = minColor;
                this.saveObj.nodeSettings.nodeColorContinuousMax = maxColor;
            }

            this.saveObj.nodeSettings.nodeColorAttribute = attribute;

            // Edge will also need updating if they are set to "node"
            if (this.commonData.edgeColorMode === "node") {
                this.setEdgeColorByNode();
            }
        }
        else if (sizeOrColor == "node-default") {
            if (this.apps[0]) this.apps[0].setNodeDefaultSizeColor();
            if (this.apps[1]) this.apps[1].setNodeDefaultSizeColor();
            if (this.apps[2]) this.apps[2].setNodeDefaultSizeColor();
            if (this.apps[3]) this.apps[3].setNodeDefaultSizeColor();

            // Edge will also need updating if they are set to "node"
            if (this.commonData.edgeColorMode === "node") {
                this.setEdgeColorByNode();
            }
        }

        this.saveObj.nodeSettings.nodeSizeOrColor = sizeOrColor;

    }

    unique = (sourceArray: any[]) => {
        var arr = [];
        for (var i = 0; i < sourceArray.length; i++) {
            if (arr.indexOf(sourceArray[i]) == -1) {
                arr.push(sourceArray[i]);
            }
        }
        return arr;
    }

    selectNodeSizeColorOnChange = () => {
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

            this.setupNodeSizeRangeSlider(attribute);
        }
        else if (value == "node-color") {
            $('#select-attribute').prop('disabled', false);

            if (this.referenceDataSet.attributes.info[attribute].isDiscrete) {
                $('#div-node-color-mode').show();
                this.setupColorPickerDiscrete(attribute);
            } else {
                $('#div-node-color-mode').hide();
                this.setupColorPicker();
            }
        }

        this.setNodeSizeOrColor();
    }

    loadSettings = () => {
        if (!(this.referenceDataSet && this.referenceDataSet.attributes && this.referenceDataSet.brainCoords && this.referenceDataSet.simMatrix)) {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Dataset is required!");
            return;
        }

        var file = (<any>$('#input-select-load-file').get(0)).files[0];
        var reader = new FileReader();
        reader.onload = () => {
            this.saveObj = new SaveFile({});
            this.saveObj.fromYaml(reader.result.toLowerCase());

            for (var i = 0; i < 4; i++) {
                if (!jQuery.isEmptyObject(this.saveObj.saveApps[i])) {
                    this.initApp(i);
                }
            }
        }
        reader.readAsText(file);
    }

    saveSettings = () => {
        var filename = "brain-model.cfg";
        var body = document.body;

        //Save all the apps
        for (var i = 0; i < 4; i++) {
            var app = this.saveObj.saveApps[i];
            if (this.apps[i]) this.apps[i].save(app);
        }

        var configText = this.saveObj.toYaml();

        var url = window["URL"].createObjectURL(new Blob([configText], { "type": "text\/xml" }));

        var a = document.createElement("a");
        body.appendChild(a);
        a.setAttribute("download", filename);
        a.setAttribute("href", url);
        a.style["display"] = "none";
        a.click();

        setTimeout(() => window["URL"].revokeObjectURL(url), 10);
    }

    exportSVG = (viewport, fileType) => {
        var documents = [window.document],
            SVGSources = [];

        // loop through all active app
        if (!this.apps[viewport]) return;

        var styles = this.getStyles(document);
        var newSource = this.getSource(viewport, styles);

        // Export all svg Graph on the page
        if (fileType === "svg") {
            this.downloadSVG(newSource);
        } else if (fileType === "image") {
            this.downloadSVGImage(newSource);
        }

    }

    getSource = (id, styles) => {
        let svgInfo = {};
        let svg;
        var doctype = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
        var prefix = {
            xmlns: "http://www.w3.org/2000/xmlns/",
            xlink: "http://www.w3.org/1999/xlink",
            svg: "http://www.w3.org/2000/svg"
        };
        let canvas = this.apps[id].getDrawingCanvas();
        let svgGraph = document.getElementById("svgGraph" + id);
        if (svgGraph.getAttribute("visibility") === "hidden") {
            // Not meant to be seen, use a new blank svg
            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute('width', canvas.width);
            svg.setAttribute('height', canvas.height);
            svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
        }
        else {
            // Use as basis for combined svg
            svg = <HTMLElement>(document.getElementById("svgGraph" + id).cloneNode(true));
        }
        svg.setAttribute("version", "1.1");

        // insert 3D brain image
        // Remove old image if exists
        var oldImage = document.getElementById('brain3D' + id);
        if (oldImage) oldImage.parentNode.removeChild(oldImage);

        // 3D canvas
        var image = document.createElement("image");
        svg.insertBefore(image, svg.firstChild);
        image.setAttribute('y', '0');
        image.setAttribute('x', '0');
        image.setAttribute('id', 'brain3D' + id);
        image.setAttribute('xlink:href', canvas.toDataURL());
        image.setAttribute('width', canvas.width);
        image.setAttribute('height', canvas.height);
        image.removeAttribute('xmlns');
        // 2D canvas
        var canvas2d = <HTMLCanvasElement>$(`#div-graph-${id} div.graph2dContainer canvas[data-id='layer2-node']`).get(0);
        if (canvas2d && (canvas2d.getAttribute("visibility") !== "hidden") && this.apps[0].canvasGraph.cy) {
            var image2d = document.createElement("image");
            svg.insertBefore(image2d, svg.firstChild);
            image2d.setAttribute('crossOrigin', 'anonymous');
            image2d.setAttribute('y', '0');
            image2d.setAttribute('x', '0');
            image2d.setAttribute('id', 'brain2D' + id);
            image2d.setAttribute('xlink:href', this.apps[0].canvasGraph.cy.png({
                full: false
            }));
            image2d.setAttribute('width', canvas2d.width.toString());
            image2d.setAttribute('height', canvas2d.height.toString());
            image2d.removeAttribute('xmlns');
        }

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
        source = source.replace(/rgba\((.+?)\, (.+?)\, (.+?)\,.+?\)/g, rgbaText => {
            let vals = /rgba\((.+?)\, (.+?)\, (.+?)\,.+?\)/i.exec(rgbaText);
            return "rgb(" + vals[1] + "," + vals[2] + "," + vals[3] + ")";
        });

        svgInfo = {
            id: svg.getAttribute("id"),
            childElementCount: svg.childElementCount,
            source: [doctype + source]
        };

        return svgInfo;
    }

    downloadSVG = source => {
        var filename = window.document.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        var body = document.body;

        var url = window["URL"].createObjectURL(new Blob(source.source, { "type": "text\/xml" }));

        var a = document.createElement("a");
        body.appendChild(a);
        a.setAttribute("class", "svg-crowbar");
        a.setAttribute("download", filename + ".svg");
        a.setAttribute("href", url);
        a.style["display"] = "none";
        a.click();

        setTimeout(() => window["URL"].revokeObjectURL(url), 10);
    }


    downloadSVGImage = source => {
        var filename = window.document.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();

        // Adapted from https://bl.ocks.org/biovisualize/8187844
        let canvas = document.createElement('canvas');
        let context = canvas.getContext('2d');
        let image = new Image();
        let svgBlob = new Blob(source.source, { type: "image/svg+xml;charset=utf-8" });
        image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0);

            var a = document.createElement("a");
            a.setAttribute("download", filename + ".jpg");
            a.setAttribute("href", canvas.toDataURL('image/jpeg', 0.9));
            a.click();
        }
        image.src = URL.createObjectURL(svgBlob);
    }

    getStyles = doc => {
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

    colorToHex = color => {
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

    getNodeScaleArray = (attribute: string) => {
        var attrArray = this.referenceDataSet.attributes.get(attribute);

        var columnIndex = this.referenceDataSet.attributes.columnNames.indexOf(attribute);

        // assume all positive numbers in the array
        var min = this.referenceDataSet.attributes.getMin(columnIndex);
        var max = this.referenceDataSet.attributes.getMax(columnIndex);

        var scaleArray: number[];
        var scaleFactor = 1;

        scaleArray = attrArray.map((value) => { return scaleFactor * value[0]; });

        return scaleArray;
    }

    setupNodeSizeRangeSlider = (attribute: string) => {
        $('#div-node-color-pickers').hide();
        $('#div-node-color-pickers-discrete').hide();
        $("#div-node-size").show();
        
        var scaleArray = this.getNodeScaleArray(attribute);
        if (!scaleArray) return;
        
        var minScale = this.saveObj.nodeSettings.nodeSizeMin || Math.min.apply(Math, scaleArray);
        var maxScale = this.saveObj.nodeSettings.nodeSizeMax || Math.max.apply(Math, scaleArray);
        var slider = $("#div-node-size-slider")['bootstrapSlider']({
            range: true,
            min: 0.1,
            max: 10,
            step: 0.1,
            value: [minScale, maxScale]
        });
        slider.on("slide", () => {
            var values = $("#div-node-size-slider")['bootstrapSlider']().data('bootstrapSlider').getValue();
            $("#label_node_size_range").text(values[0] + " - " + values[1]);
            this.setNodeSizeOrColor();
        });
        $("#label_node_size_range").text(minScale + " - " + maxScale);
    }

    setupColorPicker = () => {
        $('#div-node-size').hide();
        $('#div-node-color-pickers-discrete').hide();
        $('#div-node-color-pickers').show();
    }

    setupColorPickerDiscrete = (attribute: string) => {
        $('#div-node-size').hide();
        $('#div-node-color-pickers').hide();
        $('#div-node-color-pickers-discrete').show();

        var attrArray = this.referenceDataSet.attributes.get(attribute);
        var uniqueKeys = this.referenceDataSet.attributes.info[attribute].distinctValues;

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
        
        (<any>$("#input-node-color")).colorpicker("setValue", uniqueColors[0]);
    }

    // Find which view is currently located under the mouse
    getViewUnderMouse = (x, y) => {
        let $view = $(TL_VIEW);
        let innerViewLeft = $view.offset().left;
        if (x < innerViewLeft) return "";
        x -= innerViewLeft;
        if (y < $view.height()) {
            if (x < $view.width()) {
                return TL_VIEW;
            } else {
                return TR_VIEW;
            }
        } else {
            if (x < $view.width()) {
                return BL_VIEW;
            } else {
                return BR_VIEW;
            }
        }
    }

    getActiveTargetUnderMouse = (x: number, y: number) => {
        let view = this.getViewUnderMouse(x, y);
        return this.viewToId(view);
    }

    setNodeColorInContextMenu = (color: string) => {
        if (color.length === 6) color = "#" + color;
        if (this.apps[this.input.activeTarget]) {
            if ((this.input.rightClickLabelAppended) && (this.input.selectedNodeID >= 0)) {
                this.apps[this.input.activeTarget].setANodeColor(this.input.selectedNodeID, color);
                this.input.contextMenuColorChanged = true;
            }
        }
    }

    highlightSelectedNodes = () => {
        if (!this.referenceDataSet || !this.referenceDataSet.attributes) return;

        if (this.referenceDataSet.attributes.filteredRecordsHighlightChanged) {
            this.referenceDataSet.attributes.filteredRecordsHighlightChanged = false;

            if (!this.referenceDataSet.attributes.filteredRecords) return;

            var fRecords = this.referenceDataSet.attributes.filteredRecords;
            var idArray = new Array();

            // if all the nodes have been selected, cancel the highlight
            if (fRecords.length < this.referenceDataSet.attributes.numRecords) {
                for (var i = 0; i < fRecords.length; ++i) {
                    var id = fRecords[i]["index"];
                    idArray.push(id);
                }
            }
            
            this.apps.forEach(app => {
                app.highlightSelectedNodes(idArray);
                app.needUpdate = true;
            });
        }
    }

    setBrainMode = (brainMode, view: string) => {
        switch (view) {
            case TL_VIEW:
                this.apps[0].brainSurfaceMode = brainMode;
                break;
            case TR_VIEW:
                this.apps[1].brainSurfaceMode = brainMode;
                break;
            case BL_VIEW:
                this.apps[2].brainSurfaceMode = brainMode;
                break;
            case BR_VIEW:
                this.apps[3].brainSurfaceMode = brainMode;
                break;
        }
    }

    viewToId = (view: string): number => {
        switch (view) {
            case TL_VIEW: return 0;
            case TR_VIEW: return 1;
            case BL_VIEW: return 2;
            case BR_VIEW: return 3;
            default: return -1;
        }
    }


    setBrainModel = (view: string, model: string) => {
        let id = this.viewToId(view);
        this.loadBrainModel(model, object => {
            this.apps[id].setBrainModelObject(object);
        });
    }

    
    createBrainView = (view: string, model: string, finalCallback?, source?: string, brainSurfaceMode?) => {
        // source is "example", "empty", or "save" (default)

        let id = this.viewToId(view);

        this.loadBrainModel(model, object => {
            $(view).empty();
            let makeBrain = () => {
                this.apps[id] = new Brain3DApp(
                    {
                        id,
                        jDiv: $(view),
                        brainModelOrigin: object,
                        brainSurfaceMode
                    },
                    this.commonData,
                    this.input.newTarget(id),
                    this.saveObj
                );
                this.apps[id].setDataSet(this.referenceDataSet);
                
                this.setDataset(view);
                this.initApp(id);
                if (finalCallback) finalCallback();
            }

            let save = this.saveObj.saveApps[id] = (this.saveObj && this.saveObj.saveApps[id]) || new SaveApp({}); // create a new instance (if an old instance exists)
            save.surfaceModel = model;
            save.view = view;

            $('#button-save-app').button({ disabled: false });
            
            // Load dataset into the webapp
            if (source === "empty") {
                makeBrain();
                CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS, "Empty dataset is loaded.");
            }
            else if (this.saveObj.useExampleData()) {
                this.loadExampleData(() => {
                    makeBrain();
                    CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS, "Default example dataset is loaded.");
                });
            }
            else {
                this.loadUploadedData(this.saveObj, () => {
                    makeBrain();
                    CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS, "Uploaded dataset is loaded.");
                }, source);
            }
        });
    }
    

    setDataset = (view: string) => {
        let id = this.viewToId(view);
        if (!this.referenceDataSet) {
            // Get a dataset from the default example
            this.loadExampleData(() => this.apps[id].setDataSet(this.referenceDataSet));
        } else {
            this.apps[id].setDataSet(this.referenceDataSet);
        }
    }

    setEdgeDirection = () => {
        var value = $('#select-edge-direction').val();

        if (value === "gradient") {
            $("#div-edge-gradient-color-pickers").show();
        } else {
            $("#div-edge-gradient-color-pickers").hide();
        }

        if (this.apps[0]) this.apps[0].setEdgeDirection(value);
        if (this.apps[1]) this.apps[1].setEdgeDirection(value);
        if (this.apps[2]) this.apps[2].setEdgeDirection(value);
        if (this.apps[3]) this.apps[3].setEdgeDirection(value);
    }

    setEdgeColor = () => {
        var value = $('#select-edge-color').val();

        if (value === "none") {
            this.setEdgeNoColor();
            this.commonData.edgeColorMode = "none";
            $("#div-edge-color-pickers").hide();
            $("#div-edge-color-by-node-picker").hide();

        } else if (value === "weight") {
            this.commonData.edgeColorMode = "weight";
            $("#div-edge-color-pickers").show();
            $("#div-edge-color-by-node-picker").hide();

            // check if discrete for all apps
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.WARNING, "Current version of application assumes all view port shares the same dataset");
            if (this.referenceDataSet.info.edgeWeight.type === "continuous" || this.commonData.edgeForceContinuous) {
                if (this.referenceDataSet.info.edgeWeight.type === "continuous") {
                    $("#checkbox-edge-color-force-continuous").hide();
                }

                $("#div-edge-color-continuous").show();
                $("#div-edge-color-discrete").hide();

                if ($("#checkbox-edge-color-discretized").is(":checked")) {
                    this.commonData.edgeWeightColorMode = "continuous-discretized";
                    this.setDefaultEdgeDiscretizedValues();

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
                    this.commonData.edgeWeightColorMode = "continuous-normal";
                    $("#div-edge-color-continuous-discretized").hide();
                    $("#div-edge-color-continuous-normal").show();
                }
            } else if (this.referenceDataSet.info.edgeWeight.type === "discrete") {
                // Enable force continuous checkbox
                $("#checkbox-edge-color-force-continuous").show();

                this.commonData.edgeWeightColorMode = "discrete";
                $("#div-edge-color-continuous").hide();
                $("#div-edge-color-discrete").show();

                var distinctValues = this.referenceDataSet.info.edgeWeight.distincts;
                distinctValues.sort((a, b) => a - b);
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
                        var hex = this.colorToHex(color);
                        (<any>document.getElementById('input-edge-color')).color.fromString(hex.substring(1));
                    }
                    $('#select-edge-key').append(option);
                }
            }

            this.setEdgeColorByWeight();
        } else if (value === "node") {
            this.commonData.edgeColorMode = "node";
            this.setEdgeColorByNode();
            $("#div-edge-color-pickers").hide();
            $("#div-edge-color-by-node-picker").show();
        }
    }

    setSurfaceOpacity = () => {
        var opacity = $("#div-surface-opacity-slider")['bootstrapSlider']().data('bootstrapSlider').getValue();
        this.saveObj.surfaceSettings.opacity = opacity;

        if (this.apps[0]) this.apps[0].setSurfaceOpacity(opacity);
        if (this.apps[1]) this.apps[1].setSurfaceOpacity(opacity);
        if (this.apps[2]) this.apps[2].setSurfaceOpacity(opacity);
        if (this.apps[3]) this.apps[3].setSurfaceOpacity(opacity);
    }

    setEdgeSize = () => {
        var edgeSize = $("#div-edge-size-slider")['bootstrapSlider']().data('bootstrapSlider').getValue();
        this.saveObj.edgeSettings.size = edgeSize;
        
        if (this.apps[0]) this.apps[0].setEdgeSize(edgeSize);
        if (this.apps[1]) this.apps[1].setEdgeSize(edgeSize);
        if (this.apps[2]) this.apps[2].setEdgeSize(edgeSize);
        if (this.apps[3]) this.apps[3].setEdgeSize(edgeSize);
    }

    // Resizes the views such that the crossroads is located at (x, y) on the screen
    setViewCrossroads = (x, y) => {
        var viewWidth = $('#view-panel').width();
        var viewHeight = $('#view-panel').height();
        var lw = x - 1;
        var rw = viewWidth - x - 1;
        var th = y - 1;
        var bh = viewHeight - y - 1;
        $(TL_VIEW).css({ width: lw, height: th });
        $(TR_VIEW).css({ width: rw, height: th });
        $(BL_VIEW).css({ width: lw, height: bh });
        $(BR_VIEW).css({ width: rw, height: bh });

        // Make callbacks to the application windows
        if (this.apps[0]) this.apps[0].resize(lw, th);
        if (this.apps[1]) this.apps[1].resize(rw, th);
        if (this.apps[2]) this.apps[2].resize(lw, bh);
        if (this.apps[3]) this.apps[3].resize(rw, bh);
    }

    // Load the physiological coordinates of each node in the brain
    loadCoordinates = file => {
        var reader = new FileReader();
        reader.onload = () => {
            this.parseCoordinates(reader.result);
            this.commonData.notifyCoords();
        }
        reader.readAsText(file);
    }

    parseCoordinates = (text: string) => {
        // For some reason the text file uses a carriage return to separate coordinates (ARGGgggh!!!!)
        //var lines = text.split(String.fromCharCode(13));
        var lines = text.replace(/\t|\,/g, ' ').trim().split(/\r\n|\r|\n/g).map(s => s.trim());
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

        this.referenceDataSet.brainCoords = [Array(len), Array(len), Array(len)];
        this.referenceDataSet.info.nodeCount = len;
        for (var i = 0; i < len; ++i) {
            var words = lines[i].split(' ');
            // Translate the coords into Cola's format
            this.referenceDataSet.brainCoords[0][i] = parseFloat(words[0]);
            this.referenceDataSet.brainCoords[1][i] = parseFloat(words[1]);
            this.referenceDataSet.brainCoords[2][i] = parseFloat(words[2]);
        }
        //this.commonData.notifyCoords();
    }

    // Load the labels
    loadLabels = file => {
        let reader = new FileReader();
        reader.onload = () => {
            this.parseLabels(reader.result);
            this.commonData.notifyLabels();
        }
        reader.readAsText(file);
    }

    parseLabels = (text: string) => {
        this.referenceDataSet.brainLabels = text.replace(/\t|\n|\r/g, ' ').trim().split(' ').map(s => s.trim());
        //this.commonData.notifyLabels();
    }

    initSurfaceSettings = () => {
        if (this.saveObj.surfaceSettings.opacity) {
            $("#div-surface-opacity-slider")['bootstrapSlider']().data('bootstrapSlider').setValue(this.saveObj.surfaceSettings.opacity);
            this.setSurfaceOpacity();
        }
    }

    initEdgeSizeAndColor = () => {

        $('select-edge-direction').val(this.saveObj.edgeSettings.directionMode);
        this.setEdgeDirection();

        if (this.saveObj.edgeSettings.colorBy === "none") {
            $('#select-edge-color').val("none");
            this.setEdgeColor();

        } else if (this.saveObj.edgeSettings.colorBy === "node") {
            $('#select-edge-color').val("node");
            this.setEdgeColor();

        } else if (this.saveObj.edgeSettings.colorBy === "weight") {
            $('#select-edge-color').val("weight");
            if (this.saveObj.edgeSettings.weight.type === "continuous-discretized") {
                $('#checkbox-edge-color-discretized').prop('checked', true);
            }

            // make all corresponding elements visible

            if (this.saveObj.edgeSettings.weight.type === "discrete") {
                var setting = this.saveObj.edgeSettings.weight.discreteSetting;
                var keySelection = <any>document.getElementById('select-edge-key');

                for (var i = 0; i < setting.valueArray; i++) {
                    keySelection.options[i].style.backgroundColor = setting.colorArray[i];
                }

            } else if (this.saveObj.edgeSettings.weight.type === "continuous-normal") {
                var setting = this.saveObj.edgeSettings.weight.continuousSetting;
                
                (<any>$('#input-edge-min-color')).colorpicker("setValue", setting.minColor);
                (<any>$('#input-edge-max-color')).colorpicker("setValue", setting.maxColor);

            } else if (this.saveObj.edgeSettings.weight.type === "continuous-discretized") {
                var setting = this.saveObj.edgeSettings.weight.discretizedSetting;

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
                    (<any>$('#input-edge-discretized-' + i + '-color')).colorpicker("setValue", setting.colorArray[i]);
                }

            } else {
                throw "Load Data: Wrong data type setting for weight";
            }
            
            this.setEdgeColor();
        }
    }

    initNodeSize = () => {
        if (this.saveObj.nodeSettings.nodeSizeAttribute) {
            $('#select-node-size-color').val("node-size");
            $('#select-attribute').val(this.saveObj.nodeSettings.nodeSizeAttribute);
            
            $("#div-node-size-slider")['bootstrapSlider']().data('bootstrapSlider').setValue([this.saveObj.nodeSettings.nodeSizeMin, this.saveObj.nodeSettings.nodeSizeMax]);

            $("#label_node_size_range").text(this.saveObj.nodeSettings.nodeSizeMin + " - " + this.saveObj.nodeSettings.nodeSizeMax);
            
            this.selectNodeSizeColorOnChange();
        }
    }

    initNodeColor = () => {
        if (this.saveObj.nodeSettings.nodeColorAttribute) {
            $('#select-node-size-color').val("node-color");
            $('#select-attribute').val(this.saveObj.nodeSettings.nodeColorAttribute);

            if (this.referenceDataSet.attributes.info[this.saveObj.nodeSettings.nodeColorAttribute].isDiscrete) {
                var keySelection = <any>document.getElementById('select-node-key');

                for (var i = 0; i < keySelection.length; i++) {
                    keySelection.options[i].style.backgroundColor = this.saveObj.nodeSettings.nodeColorDiscrete[i];
                }
                
                (<any>$("#input-node-color")).colorpicker("setValue", this.saveObj.nodeSettings.nodeColorDiscrete[0]);
            }
            else {
                (<any>$("#input-min-color")).colorpicker("setValue", this.saveObj.nodeSettings.nodeColorContinuousMin);
                (<any>$("#input-max-color")).colorpicker("setValue", this.saveObj.nodeSettings.nodeColorContinuousMax);
            }
            this.selectNodeSizeColorOnChange();
        }
    }

    showLoadingNotification = () => {
        //$('body').css({ cursor: 'wait' });

        document.body.appendChild(this.divLoadingNotification);
        $('#div-loading-notification').empty(); // empty this.rightClickLabel

        this.divLoadingNotification.style.position = 'absolute';
        this.divLoadingNotification.style.left = '50%';
        this.divLoadingNotification.style.top = '50%';
        this.divLoadingNotification.style.padding = '5px';
        this.divLoadingNotification.style.borderRadius = '2px';
        this.divLoadingNotification.style.zIndex = '1';
        this.divLoadingNotification.style.backgroundColor = '#feeebd'; // the colour of the control panel

        var text = document.createElement('div');
        text.innerHTML = "Loading...";
        this.divLoadingNotification.appendChild(text);
    }

    removeLoadingNotification = () => {
        if ($('#div-loading-notification').length > 0)
            document.body.removeChild(this.divLoadingNotification);
    }

    // Load the brain surface (hardcoded - it is not simple to load geometry from the local machine, but this has not been deeply explored yet).
    // NOTE: The loaded model cannot be used in more than one WebGL context (scene) at a time - the geometry and materials must be .cloned() into
    // new THREE.Mesh() objects by the application wishing to use the model.
    loadBrainModel = (model: string, callback) => {
        let file = (model === 'ch2') && 'BrainMesh_Ch2withCerebellum.obj'
            || (model === 'icbm') && 'BrainMesh_ICBM152.obj'
            ;
        if (!file) {
            callback();
            return;
        }

        this.loader.load('examples/graphdata/' + file, object => {
            if (!object) {
                CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Failed to load brain surface.");
                return;
            }

            callback(object);
        });
    }


    setBrainSurfaceColor = (color: string) => {
        this.saveObj.surfaceSettings.color = color;

        if (this.apps[0]) this.apps[0].setSurfaceColor(color);
        if (this.apps[1]) this.apps[1].setSurfaceColor(color);
        if (this.apps[2]) this.apps[2].setSurfaceColor(color);
        if (this.apps[3]) this.apps[3].setSurfaceColor(color);
    }


    setEdgeTransitionColor = (color: string) => {
        this.saveObj.edgeSettings.edgeColorByNodeTransitionColor = color;

        if (this.apps[0]) this.apps[0].setEdgeTransitionColor(color);
        if (this.apps[1]) this.apps[1].setEdgeTransitionColor(color);
        if (this.apps[2]) this.apps[2].setEdgeTransitionColor(color);
        if (this.apps[3]) this.apps[3].setEdgeTransitionColor(color);
    }


    setUseTransitionColor = (useColor: boolean) => {
        this.saveObj.edgeSettings.edgeColorByNodeTransition = useColor;

        if (this.apps[0]) this.apps[0].setUseTransitionColor(useColor);
        if (this.apps[1]) this.apps[1].setUseTransitionColor(useColor);
        if (this.apps[2]) this.apps[2].setUseTransitionColor(useColor);
        if (this.apps[3]) this.apps[3].setUseTransitionColor(useColor);
    }


    // Load the similarity matrix for the specified dataSet
    //TODO: Move into DataSet class
    loadSimilarityMatrix = (file, dataSet: DataSet, callback?) => {
        var reader = new FileReader();
        reader.onload = () => {
            this.parseSimilarityMatrix(reader.result, dataSet);
            if (callback) callback();
        };
        reader.readAsText(file);
    }

    parseSimilarityMatrix = (text: string, dataSet: DataSet) => {
    //TODO: Move into DataSet class
        var lines = text.replace(/\t|\,/g, ' ').trim().split(/\r\n|\r|\n/g).map(s => s.trim());
        var simMatrix = [];
        lines.forEach((line, i) => {
            if (line.length > 0) {
                simMatrix.push(line.split(' ').map(parseFloat));
            }
        });
        // Normalise values to range 0...1, files can have very different value ranges
        let max = simMatrix[0][0];
        let min = simMatrix[0][0];
        let i = simMatrix.length;
        while (i--) {
            let j = simMatrix[i].length;
            while (j--) {
                let weight = simMatrix[i][j];
                max = Math.max(max, weight);
                min = Math.min(min, weight);
            }
        }
        let scale = d3.scale.linear().domain([min, max]).range([0, 1]);
        simMatrix = simMatrix.map(row => row.map(scale));

        dataSet.setSimMatrix(simMatrix);
    }

    // Load the attributes for the specified dataSet
    //TODO: Move into DataSet class
    loadAttributes = (file, dataSet: DataSet, callback?) => {
        var reader = new FileReader();
        reader.onload = () => {
            this.parseAttributes(reader.result, dataSet);
            dataSet.notifyAttributes();
            if (callback) callback();
        };
        reader.readAsText(file);
    }

    parseAttributes = (text: string, dataSet: DataSet) => {
    //TODO: Move into DataSet class
        var newAttributes = new Attributes(text);
        dataSet.attributes = newAttributes;
        //dataSet.notifyAttributes();
    }

    setupCrossFilter = (attrs: Attributes) => {
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
        // listener
        let filtered = () => {
            this.referenceDataSet.attributes.filteredRecords = dimArray[0].top(Number.POSITIVE_INFINITY);
            this.referenceDataSet.attributes.filteredRecordsHighlightChanged = true;

            $('#button-apply-filter').button("enable");
        }
        for (var j = 0; j < attrs.columnNames.length; ++j) {
            $('#barCharts').append('<div id="barChart' + j + '"></div>');
            var chart = dc.barChart("#barChart" + j);

            var columnName = attrs.columnNames[j];
            var minValue = attrs.getMin(j);
            var maxValue = attrs.getMax(j);
            var offset = (maxValue - minValue) * 0.1;

            var dim = cfilter.dimension(d => d[columnName]);
            dimArray.push(dim);
            var group = dim.group().reduceCount(d => d[columnName]);

            chart
                .gap(5)
                .width(270)
                .height(150)
                .dimension(dim)
                .group(group)
                .x(d3.scale.linear().domain([minValue - offset, maxValue + offset]))
                .xAxisLabel(columnName)
                .xUnits(() => 25)       //TODO: this could be smarter
                .centerBar(true)
                .on("filtered", filtered)
                .xAxis().ticks(6);
        }

        // keep track of total readings
        d3.select("#total").text(totalReadings);

        $('#button-apply-filter').button("disable");

        // render all charts
        dc.renderAll();
    }


    /*
        Functions to set up interaction, when everything else is ready
    */
    
    initListeners = () => {

        $(document).keyup(e => {
            if (e.keyCode == 27) this.toggleSplashPage();   // esc
        });


        // Colour pickers
        $("#input-node-color").on("changeColor", e => {
            this.setSelectNodeKeyBackgroundColor((<any>e).color.toHex());
            this.setNodeSizeOrColor();
        });
        $("#input-surface-color").on("changeColor", e => this.setBrainSurfaceColor((<any>e).color.toHex()));
        $("#input-min-color").on("changeColor", e => this.setNodeSizeOrColor());
        $("#input-max-color").on("changeColor", e => this.setNodeSizeOrColor());
        $("#input-edge-start-color").on("changeColor", e => this.setEdgeDirectionGradient());
        $("#input-edge-end-color").on("changeColor", e => this.setEdgeDirectionGradient());
        $("#input-edge-discretized-0-color").on("changeColor", e => this.setEdgeColorByWeight());
        $("#input-edge-discretized-1-color").on("changeColor", e => this.setEdgeColorByWeight());
        $("#input-edge-discretized-2-color").on("changeColor", e => this.setEdgeColorByWeight());
        $("#input-edge-discretized-3-color").on("changeColor", e => this.setEdgeColorByWeight());
        $("#input-edge-discretized-4-color").on("changeColor", e => this.setEdgeColorByWeight());
        $("#input-edge-min-color").on("changeColor", e => this.setEdgeColorByWeight());
        $("#input-edge-max-color").on("changeColor", e => this.setEdgeColorByWeight());
        $("#input-edge-color").on("changeColor", e => {
            this.setSelectEdgeKeyBackgroundColor((<any>e).color.toHex());
            this.setEdgeColorByWeight()
        });
        $("#input-context-menu-node-color").on("changeColor", e => this.setNodeColorInContextMenu((<any>e).color.toHex()));
        $("#input-edge-transitional-color").on("changeColor", e => this.setEdgeTransitionColor((<any>e).color.toHex()));


        $('#button-select-matrix').click(() => $("#select-matrix").click());
        $('#select-matrix').on('change', () => {
            // Change the button name according to the file name
            let file = (<any>$('#select-matrix').get(0)).files[0];
            //document.getElementById("button-select-matrix").innerHTML = file.name;
            document.getElementById("button-select-matrix-filename").innerHTML = file.name;

            // update file status to changed
            this.changeFileStatus("matrix-status", "changed");

            // Parse and upload attribute file
            this.uploadMatrix();

        });

        $('#button-select-attrs').click(() => $("#select-attrs").click());

        $('#select-attrs').on('change', () => {
            // Change the button name according to the file name
            var file = (<any>$('#select-attrs').get(0)).files[0];
            //document.getElementById("button-select-attrs").innerHTML = file.name;
            document.getElementById("button-select-attrs-filename").innerHTML = file.name;
            // update file status to changed
            this.changeFileStatus("attrs-status", "changed");

            // Parse and upload attribute file
            this.uploadAttr();
        });

        $('#button-select-labels').click(() => $("#select-labels").click());

        $('#select-labels').on('change', () => {
            // Change the button name according to the file name
            var file = (<any>$('#select-labels').get(0)).files[0];
            //document.getElementById("button-select-labels").innerHTML = file.name;
            document.getElementById("button-select-labels-filename").innerHTML = file.name;

            // update file status to changed
            this.changeFileStatus("labels-status", "changed");

            // Parse and upload labels
            this.uploadLabels();
        });
        
        $('#button-load-settings').button().click(() => $("#input-select-load-file").click());

        $('#input-select-load-file').on('change', this.loadSettings);

        $('#button-save-settings').button().click(this.saveSettings);

        $('#button-export-svg').button().click(() => $("#exportModal")["modal"]());

        $('#button-export-submit').button().click(() => {
            var viewport = $('#select-export-viewport').val();
            var type = $('#select-export-type').val();

            this.exportSVG(parseInt(viewport), type)
        });

        $('#button-save-app').button().click(() => {
            //Save all the apps
            for (var i = 0; i < 4; i++) {
                var app = this.saveObj.saveApps[i];
                if (this.apps[i]) this.apps[i].save(app);
            }

            var saveJson = JSON.stringify(this.saveObj);
            $.post("brain-app/saveapp.aspx",
                {
                    save: saveJson
                },
                (data, status) => {
                    if (status.toLowerCase() == "success") {
                        var url = document.URL.split('?')[0];
                        prompt("The project is saved. Use the following URL to restore the project:", url + "?save=" + data);
                    }
                    else {
                        alert("save: " + status);
                    }
                });
        });

        $('[data-toggle="btns"] .btn').on('click', function () {
            var $this = $(this);
            $this.parent().find('.active').removeClass('active');
            $this.addClass('active');
        });

        $('#button-upload-model').button().click(() => {
            CommonUtilities.launchAlertMessage(CommonUtilities.alertType.WARNING, "Uploading the brain model...");
            var file = (<any>$('#input-select-model').get(0)).files[0];
            if (file) {
                var reader = new FileReader();
                reader.onload = () => {
                    let brainModel = this.loader.parse(reader.result);
                    this.apps[0].setBrainModelObject(brainModel);
                    CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS, "New brain model uploaded");
                };
                reader.onerror = () => {
                    let message = "Failed to upload model " + file;
                    CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, message);
                    console.log(message);
                };

                reader.readAsText(file);
            }
        });

        $('#load-example-data').button().click(() => this.loadExampleData(() => this.apps.forEach(app => app.setDataSet(this.referenceDataSet))));

        $('#button-apply-filter').button().click(this.applyFilterButtonOnClick);

        $('#button-apply-filter').button("disable");

        $('#button-set-node-size-color').button().click(this.setNodeSizeOrColor);

        $('#select-node-size-color').on('change', this.selectNodeSizeColorOnChange);

        $("#checkbox-node-color-continuous").on("change", () => {
            var attribute = $('#select-attribute').val();
            var nodeColorMode = $('#checkbox-node-color-continuous').is(":checked");
            if (!nodeColorMode && this.referenceDataSet.attributes.info[attribute].isDiscrete) {
                this.setupColorPickerDiscrete(attribute);
            }
            else {
                this.setupColorPicker();
            }

            this.setNodeSizeOrColor();
        });

        $("#checkbox-color-transitional-edges").on("change", () => {
            let useTransitionColor = $('#checkbox-color-transitional-edges').is(":checked");
            this.setUseTransitionColor(useTransitionColor);
        });

        $('#select-attribute').on('change', this.setupAttributeNodeControls);

        $('#select-node-key').on('change', () => {
            var key = $('#select-node-key').val();

            var keySelection = <any>document.getElementById('select-node-key');
            
            for (var i = 0; i < keySelection.length; i++) {
                if (keySelection.options[i].value == key) {
                    var color = keySelection.options[i].style.backgroundColor;
                    var hex = this.colorToHex(color);
                    (<any>$("#input-node-color")).colorpicker("setValue", hex);
                    
                    break;
                }
            }
        });

        $('#select-edge-key').on('change', () => {
            var key = $('#select-edge-key').val();

            var keySelection = <any>document.getElementById('select-edge-key');

            // find the coressponding key and retrieve colour data
            for (var i = 0; i < keySelection.length; i++) {
                if (keySelection.options[i].value == key) {
                    var color = keySelection.options[i].style.backgroundColor;
                    var hex = this.colorToHex(color);
                    (<any>$('#input-edge-color')).colorpicker("setValue", hex);
                    break;
                }
            }
        });

        this.input.regMouseLocationCallback(this.getActiveTargetUnderMouse);
        this.input.regMouseUpCallback(this.highlightSelectedNodes);

        // Set up selectability of view spaces
        $(TL_VIEW).click(() => this.selectView(TL_VIEW));
        $(TR_VIEW).click(() => this.selectView(TR_VIEW));
        $(BL_VIEW).click(() => this.selectView(BL_VIEW));
        $(BR_VIEW).click(() => this.selectView(BR_VIEW));

        //TODO: Bring this back with multi-view
        /*
        $('#checkbox_yoking_view').on('change', () => {
            if ($('#checkbox_yoking_view').is(":checked")) {
                this.input.yokingView = true;
            }
            else {
                this.input.yokingView = false;
            }
        });
        */

        $('#checkbox-thickness-by-weight').on('change', () => {
            if ($('#checkbox-thickness-by-weight').is(":checked")) {
                if (this.apps[0]) this.apps[0].setEdgeThicknessByWeight(true);
                if (this.apps[1]) this.apps[1].setEdgeThicknessByWeight(true);
                if (this.apps[2]) this.apps[2].setEdgeThicknessByWeight(true);
                if (this.apps[3]) this.apps[3].setEdgeThicknessByWeight(true);
            }
            else {
                if (this.apps[0]) this.apps[0].setEdgeThicknessByWeight(false);
                if (this.apps[1]) this.apps[1].setEdgeThicknessByWeight(false);
                if (this.apps[2]) this.apps[2].setEdgeThicknessByWeight(false);
                if (this.apps[3]) this.apps[3].setEdgeThicknessByWeight(false);
            }
        });

        $('#checkbox-edge-color-force-continuous').on('change', () => {
            if ($("#checkbox-edge-color-force-continuous").is(":checked")) {
                this.commonData.edgeForceContinuous = true;
            } else {
                this.commonData.edgeForceContinuous = false;
            }
            this.setEdgeColor();
        });

        $('#checkbox-edge-color-discretized').on('change', () => {
            if ($("#checkbox-edge-color-discretized").is(":checked")) {
                this.setDefaultEdgeDiscretizedValues();
                $("#div-edge-color-continuous-discretized").show();
                $("#div-edge-color-continuous-normal").hide();
                this.commonData.edgeWeightColorMode = "continuous-discretized";

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
                this.commonData.edgeWeightColorMode = "continuous-normal";
            }

            this.setEdgeColorByWeight();
        });

        $('#select-edge-direction').on('change', () => {
            this.saveObj.edgeSettings.directionMode = $('#select-edge-direction').val();
            this.setEdgeDirection();
        });

        $('#select-edge-color').on('change', () => {
            this.setEdgeColor();
        });
        
        $('#select-brain3d-model').on('change', () => {
            var model = $('#select-brain3d-model').val();

            if (model === "upload") {
                $("#div-upload-brain-model").show();
            } else {
                $("#div-upload-brain-model").hide();
                
                var model = $('#select-brain3d-model').val();
                this.setBrainModel(TL_VIEW, model);
            }
        });

        $('#select-edge-color-number-discretized-category').on('change', () => {
            var numCategory = Number($('#select-edge-color-number-discretized-category').val());

            this.setDefaultEdgeDiscretizedValues();
            for (var i = 0; i < 5; i++) {
                if (i < numCategory) {
                    $('#div-edge-discretized-' + i).show();
                } else {
                    $('#div-edge-discretized-' + i).hide();
                }
            }

            this.setEdgeColorByWeight();
        });

        $('#input-edge-discretized-' + 0 + '-from').on('change keyup paste', this.setEdgeColorByWeight);

        $('#input-edge-discretized-' + 4 + '-to').on('change keyup paste', this.setEdgeColorByWeight);

        $('#input-edge-discretized-1-from').on('change keyup paste', () => {
            var val = $('#input-edge-discretized-1-from').val();
            $('#input-edge-discretized-0-to').val(val);
            this.setEdgeColorByWeight();
        });

        $('#input-edge-discretized-2-from').on('change keyup paste', () => {
            var val = $('#input-edge-discretized-2-from').val();
            $('#input-edge-discretized-1-to').val(val);
            this.setEdgeColorByWeight();
        });

        $('#input-edge-discretized-3-from').on('change keyup paste', () => {
            var val = $('#input-edge-discretized-3-from').val();
            $('#input-edge-discretized-2-to').val(val);
            this.setEdgeColorByWeight();
        });

        $('#input-edge-discretized-4-from').on('change keyup paste', () => {
            var val = $('#input-edge-discretized-4-from').val();
            $('#input-edge-discretized-3-to').val(val);
            this.setEdgeColorByWeight();
        });

        $('#input-edge-discretized-0-to').on('change keyup paste', () => {
            var val = $('#input-edge-discretized-0-to').val();
            $('#input-edge-discretized-1-from').val(val);
            this.setEdgeColorByWeight();
        });

        $('#input-edge-discretized-1-to').on('change keyup paste', () => {
            var val = $('#input-edge-discretized-1-to').val();
            $('#input-edge-discretized-2-from').val(val);
            this.setEdgeColorByWeight();
        });

        $('#input-edge-discretized-2-to').on('change keyup paste', () => {
            var val = $('#input-edge-discretized-2-to').val();
            $('#input-edge-discretized-3-from').val(val);
            this.setEdgeColorByWeight();
        });

        $('#input-edge-discretized-3-to').on('change keyup paste', () => {
            var val = $('#input-edge-discretized-3-to').val();
            $('#input-edge-discretized-4-from').val(val);
            this.setEdgeColorByWeight();
        });
        
        window.addEventListener('resize', () => {
            let newViewWidth = $('#outer-view-panel').width();
            let newViewHeight = $('#outer-view-panel').height();
            let xScale = newViewWidth / this.viewWidth;
            let yScale = newViewHeight / this.viewHeight;
            let pinPos = $('#pin').position();
            let newPinX = pinPos.left * xScale;
            let newPinY = pinPos.top * yScale;

            $('#pin').css({ left: newPinX, top: newPinY });
            this.setViewCrossroads(newPinX, newPinY);

            this.viewWidth = newViewWidth;
            this.viewHeight = newViewHeight;
        }, false);
    }

}



//////////////////////////////////////////////////////////////////
///                  On Default                                 //
//////////////////////////////////////////////////////////////////

function defaultFunction() {
    let neuroMarvl = new NeuroMarvl();
    neuroMarvl.start();
}

