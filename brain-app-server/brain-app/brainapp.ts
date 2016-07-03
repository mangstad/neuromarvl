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

            //TODO: This bit isn't useful now as there is no mechanism to clear apps. It also should be somewhere else.
            // Kept for now, because app deletion will probably need to be implemented in the future.
            /*
            for (var i = 0; i < 4; ++i) {
                if (apps[i] && apps[i].isDeleted()) {
                    apps[i] = null;
                    saveObj.saveApps[i] = null; // create a new instance (if an old instance exists)
                }
            }
            */

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
    saveObj = new SaveFile();
    loadObj: SaveFile;
    loader;     // THREE.ObjLoader
    apps: Application[];

    pointerImage = new PointerImageImpl;

    viewWidth = 0;
    viewHeight = 0;
    pinWidth = 0;
    pinHeight = 0;

    // UI elements
    visIcons;
    divLoadingNotification;

    input: InputTargetManager;


    constructor() {
        this.brainSurfaceColor = "0xe3e3e3";

        // Set up OBJ loading
        let manager = new THREE.LoadingManager();
        manager.onProgress = (item, loaded, total) => {
            console.log(item, loaded, total);
        };
        this.loader = new (<any>THREE).OBJLoader(manager);

        this.apps = Array<Application>(null, null, null, null);

        // Set up the class that will manage which view should be receiving input
        this.input = new InputTargetManager([TL_VIEW, TR_VIEW, BL_VIEW, BR_VIEW], this.pointerImage);
        this.input.setActiveTarget(0);
    }

    start = () => {
        this.initUI();

        let commonInit = () => {
            this.initDataDependantUI();
            this.initListeners();
        }
        let callbackWithSave = (source, data) => {
            this.initProject(data, source);
            commonInit();
        };
        let callbackNoSave = () => {
            console.log(TL_VIEW);///jm
            this.applyModelToBrainView(TL_VIEW, $('#select-brain3d-model').val());
            this.toggleSplashPage();
            commonInit();
        };
        this.initFromSaveFile(callbackWithSave, callbackNoSave);
    }


    /*
        Functions to create a solid starting state and all UI elements available
    */

    initUI = () => {
        console.log("initUI");

        // Initialize the view sizes and pin location
        this.viewWidth = $('#outer-view-panel').width();
        this.viewHeight = $('#outer-view-panel').height();
        this.pinWidth = $('#pin').width();
        this.pinHeight = $('#pin').height();

        // Data set icons are visible when the page loads - reset them immediately
        this.visIcons = [$('#brain3d-icon-front')];
        // Load notification
        this.divLoadingNotification = document.createElement('div');
        this.divLoadingNotification.id = 'div-loading-notification';

        /* 
            Set up jQuery UI layout objects
        */
        $("[data-toggle='tooltip']").tooltip(<any>{ container: 'body' });

        $("#tab2").click(() => setTimeout(this.resetDataSetIcon, 0));
        
        /*
            Upload files buttons
        */
        $('#button-select-coords').click(() => $("#select-coords").click());
        $('#select-coords').on('change', () => {
            // Change the button name according to the file name
            var file = (<any>$('#select-coords').get(0)).files[0];
            document.getElementById("button-select-coords").innerHTML = file.name;

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
    }

    initFromSaveFile = (callbackWithSave, callbackNoSave) => {
        var query = window.location.search.substring(1);
        if (query && query.length > 0) {
            this.showLoadingNotification();

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
                (data, status) => {
                    if (status.toLowerCase() == "success") {
                        callbackWithSave();
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

    initProject = (data: string, source = "save") => {
        // Ensure that data is not empty
        if (!data || !data.length) return;

        this.loadObj = <SaveFile>jQuery.parseJSON(data);
        this.saveObj.loadExampleData = (source !== "save");

        for (var app of this.loadObj.saveApps) {
            if (app.surfaceModel && (app.surfaceModel.length > 0)) {
                this.applyModelToBrainView(app.view, app.surfaceModel, app.brainSurfaceMode);
            }
        }
    }


    /*
        Functions to work with app state
    */

    initApp = id => {
        // init edge count
        var app = this.loadObj.saveApps[id];
        if ((app.surfaceModel != null) && (app.surfaceModel.length > 0)) {
            this.apps[id].initEdgeCountSlider(app);
        }

        // init cross filter
        if ((this.loadObj.filteredRecords != null) && (this.loadObj.filteredRecords.length > 0)) {
            this.referenceDataSet.attributes.filteredRecords = this.loadObj.filteredRecords.slice(0);
            this.applyFilterButtonOnClick();
        }

        // init show network
        if ((app.surfaceModel != null) && (app.surfaceModel.length > 0)) {
            this.apps[id].initShowNetwork(app);
        }


        // init the node size and color given the current UI. The UI needs to be redesigned.
        if ((this.loadObj.nodeSettings.nodeSizeOrColor != null) && (this.loadObj.nodeSettings.nodeSizeOrColor.length > 0)) {
            if (this.loadObj.nodeSettings.nodeSizeOrColor == "node-size") {
                this.initNodeColor();
                this.initNodeSize();
            }
            else if (this.loadObj.nodeSettings.nodeSizeOrColor == "node-color") {
                this.initNodeSize();
                this.initNodeColor();
            }
        }

        // init edge size and color.
        if (this.loadObj.edgeSettings != null) {
            this.initEdgeSizeAndColor();
        }

        // init Surface Setting
        if (this.loadObj.surfaceSettings != null) {
            this.initSurfaceSettings();
        }
        this.removeLoadingNotification();
    }

    initDataDependantUI = () => {
        // Reset all (surface tab) icons
        this.resetBrain3D();
        this.resetDataSetIcon();
        this.showVisIcons();

        this.selectView(TL_VIEW);
    }

    batchProcess = (i, numberOfFiles, attributes, matrices) => {
        // Load pair of files into dataset
        this.loadAttributes(attributes[i], this.referenceDataSet);
        this.loadSimilarityMatrix(matrices[i], this.referenceDataSet);

        // Load the new dataset to the app (always use the first viewport - top left);
        this.setDataset(TL_VIEW);

        // refresh the visualisation with current settings and new data
        this.apps[0].showNetwork(false);
        this.setEdgeColor();
        this.setNodeSizeOrColor();
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
            setTimeout(function () {
                this.batchProcess(i, numberOfFiles, attributes, matrices)
            }, 1000);
        } else {
            $("#alertModal")["modal"]('hide');
        }
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

    loadExampleData = (view, func) => {
        var status = {
            coordLoaded: false,
            matrixLoaded: false,
            attrLoaded: false,
            labelLoaded: false
        };

        var callback = () => {
            if (status.coordLoaded && status.matrixLoaded && status.attrLoaded && status.labelLoaded) {
                func(view);
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
            document.getElementById("button-select-coords").innerHTML = "coords.txt";
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
            document.getElementById("button-select-matrix").innerHTML = "mat1.txt";
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
            document.getElementById("button-select-attrs").innerHTML = "attributes1.txt";
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
            document.getElementById("button-select-labels").innerHTML = "labels.txt";
            this.changeFileStatus("labels-status", "uploaded");

            callback();
        });

        this.saveObj.loadExampleData = true;
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

    loadUploadedData = (loadObj, view, func, source = "save") => {
        this.saveObj.loadExampleData = false;
        var status = {
            coordLoaded: false,
            matrixLoaded: false,
            attrLoaded: false,
            labelLoaded: (loadObj.serverFileNameLabel) ? false : true
        };

        var callback = () => {
            if (status.coordLoaded && status.matrixLoaded && status.attrLoaded && status.labelLoaded) {
                func(view);
            }
        }

        $.get('brain-app/' + source + '/' + loadObj.serverFileNameCoord, text => {
            this.parseCoordinates(text);
            //$('#shared-coords').css({ color: 'green' });
            $('#label-coords')
                .text("Pre-uploaded data")
                .css({ color: 'green' });
            status.coordLoaded = true;
            // change status
            document.getElementById("button-select-coords").innerHTML = loadObj.serverFileNameCoord;
            this.changeFileStatus("coords-status", "uploaded");

            callback();
        });
        $.get('brain-app/' + source + '/' + loadObj.serverFileNameMatrix, text => {
            this.parseSimilarityMatrix(text, this.referenceDataSet);
            //$('#d1-mat').css({ color: 'green' });
            $('#label-similarity-matrix')
                .text("Pre-uploaded data")
                .css({ color: 'green' });
            status.matrixLoaded = true;

            // change status
            document.getElementById("button-select-matrix").innerHTML = loadObj.serverFileNameMatrix;
            this.changeFileStatus("matrix-status", "uploaded");

            callback();
        });
        $.get('brain-app/' + source + '/' + loadObj.serverFileNameAttr, text => {
            this.parseAttributes(text, this.referenceDataSet);
            //$('#d1-att').css({ color: 'green' });
            $('#label-attributes')
                .text("Pre-uploaded data")
                .css({ color: 'green' });
            this.setupAttributeTab();
            status.attrLoaded = true;
            // change status
            document.getElementById("button-select-attrs").innerHTML = loadObj.serverFileNameAttr;
            this.changeFileStatus("attrs-status", "uploaded");

            callback()
        });
        // Check if Label file is uploaded
        if (loadObj.serverFileNameLabel) {
            $.get('brain-app/' + source + '/' + loadObj.serverFileNameLabel, text => {
                this.parseLabels(text);
                //$('#shared-labels').css({ color: 'green' });
                $('#label-labels')
                    .text("Pre-uploaded data")
                    .css({ color: 'green' });
            });
            status.labelLoaded = true;

            // change status
            document.getElementById("button-select-labels").innerHTML = loadObj.serverFileNameLabel;
            this.changeFileStatus("labels-status", "uploaded");

            callback();
        }
        $('#load-example-data').button().prop("disabled", "disabled");

    }

    setupAttributeTab = () => {
        if (this.referenceDataSet && this.referenceDataSet.attributes) {
            $('#select-attribute').empty();
            for (var i = 0; i < this.referenceDataSet.attributes.columnNames.length; ++i) {
                var columnName = this.referenceDataSet.attributes.columnNames[i];
                $('#select-attribute').append('<option value = "' + columnName + '">' + columnName + '</option>');
            }

            $('#div-set-node-scale').show();

            $('#div-node-size').hide();
            $('#div-node-color-pickers').hide();
            $('#div-node-color-pickers-discrete').hide();

            $('#select-node-size-color').val('node-default');
            $('#select-attribute').prop("disabled", "disabled");

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

        if (this.apps[0]) this.apps[0].applyFilter(idArray);
        if (this.apps[1]) this.apps[1].applyFilter(idArray);
        if (this.apps[2]) this.apps[2].applyFilter(idArray);
        if (this.apps[3]) this.apps[3].applyFilter(idArray);

        this.saveObj.filteredRecords = this.referenceDataSet.attributes.filteredRecords;
    }

    setSelectEdgeKeyBackgroundColor = (color: string) => {
        var keySelection = <any>document.getElementById('select-edge-key');
        keySelection.options[keySelection.selectedIndex].style.backgroundColor = '#' + color;
    }

    setSelectNodeKeyBackgroundColor = (color: string) => {
        var keySelection = <any>document.getElementById('select-node-key');
        keySelection.options[keySelection.selectedIndex].style.backgroundColor = '#' + color;
    }

    setDefaultEdgeDiscretizedValues = () => {
        //Assume data is shared across app
        var range = this.apps[0].getCurrentEdgeWeightRange();
        var numCategory = Number($('#select-edge-color-number-discretized-category').val());
        var step = (range.max - range.min) / numCategory;
        $('#input-edge-discretized-' + 0 + '-from').val(range.min);
        $('#input-edge-discretized-' + (numCategory - 1) + '-to').val(range.max);
        for (var i = 0; i < numCategory - 1; i++) {
            $('#input-edge-discretized-' + (i + 1) + '-from').val(range.min + step * (i + 1));
            $('#input-edge-discretized-' + i + '-to').val(range.min + step * (i + 1));
        }
    }

    setEdgeDirectionGradient = () => {
        this.saveObj.edgeSettings.directionStartColor = $('#input-edge-start-color').val();
        this.saveObj.edgeSettings.directionEndColor = $('#input-edge-end-color').val();

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
                colorArray[colorArray.length] = "#" + $('#input-edge-discretized-' + i + '-color').val();
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
            var minColor = $('#input-edge-min-color').val();
            var maxColor = $('#input-edge-max-color').val();
            minColor = '#' + minColor;
            maxColor = '#' + maxColor;

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
        // save edge color setting
        this.saveObj.edgeSettings.colorBy = "node";

        if (this.apps[0]) this.apps[0].setEdgeColorByNode();
        if (this.apps[1]) this.apps[1].setEdgeColorByNode();
        if (this.apps[2]) this.apps[2].setEdgeColorByNode();
        if (this.apps[3]) this.apps[3].setEdgeColorByNode();
    }

    setEdgeNoColor = () => {
        // save edge color setting 
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
                    var key = keySelection.options[i].value;
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
                var minColor = $('#input-min-color').val();
                var maxColor = $('#input-max-color').val();

                minColor = '#' + minColor;
                maxColor = '#' + maxColor;

                if (this.apps[0]) this.apps[0].setNodeColor(attribute, minColor, maxColor);
                if (this.apps[1]) this.apps[1].setNodeColor(attribute, minColor, maxColor);
                if (this.apps[2]) this.apps[2].setNodeColor(attribute, minColor, maxColor);
                if (this.apps[3]) this.apps[3].setNodeColor(attribute, minColor, maxColor);

                this.saveObj.nodeSettings.nodeColorMode = "continuous";
                this.saveObj.nodeSettings.nodeColorContinuousMin = minColor;
                this.saveObj.nodeSettings.nodeColorContinuousMax = maxColor;
            }

            this.saveObj.nodeSettings.nodeColorAttribute = attribute;
        }
        else if (sizeOrColor == "node-default") {
            if (this.apps[0]) this.apps[0].setNodeDefaultSizeColor();
            if (this.apps[1]) this.apps[1].setNodeDefaultSizeColor();
            if (this.apps[2]) this.apps[2].setNodeDefaultSizeColor();
            if (this.apps[3]) this.apps[3].setNodeDefaultSizeColor();
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
            this.loadObj = new SaveFile();
            this.loadObj.fromYaml(reader.result.toLowerCase());

            for (var i = 0; i < 4; i++) {
                if (!jQuery.isEmptyObject(this.loadObj.saveApps[i])) {
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

    exportSVG = (viewport, type) => {
        var documents = [window.document],
            SVGSources = [];

        // loop through all active app
        if (!this.apps[viewport]) return;

        var styles = this.getStyles(document);
        var newSource = this.getSource(viewport, styles);

        // Export all svg Graph on the page
        if (type === "svg") {
            this.downloadSVG(newSource);
        } else if (type === "image") {
            this.downloadSVGImage(newSource);
        }

    }

    getSource = (id, styles) => {
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

        var canvas = this.apps[id].getDrawingCanvas();
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

        setTimeout(() => window["URL"].revokeObjectURL(url), 10);
    }

    downloadSVGImage = source => {
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
        image.onload = () => {
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
        //var scaleFactor = 0.5;
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

        var minScale = Math.min.apply(Math, scaleArray);
        var maxScale = Math.max.apply(Math, scaleArray);
        var slider = $("#div-node-size-slider")['bootstrapSlider']({
            range: true,
            min: 0.1,
            max: 10,
            step: 0.1,
            value: [minScale, maxScale],
            change: this.setNodeSizeOrColor,
        });
        slider.on("slide", () => {
            var values = $("#div-node-size-slider")['bootstrapSlider']().data('bootstrapSlider').getValue();
            $("#label_node_size_range").text(values[0] + " - " + values[1]);
            this.setNodeSizeOrColor();
        });
        slider.on("change", this.setNodeSizeOrColor);
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

        (<any>document.getElementById('input-node-color')).color.fromString(uniqueColors[0].substring(1));
    }

    // Find which view is currently located under the mouse
    getViewUnderMouse = (x, y) => {
        //var innerViewLeft = $(TL_VIEW).offset().left;
        //if (x < innerViewLeft) {
        //    return null;
        //} else {
            //x -= innerViewLeft;
            //if (y < $(TL_VIEW).height()) {
            //    if (x < $(TL_VIEW).width()) {
            //        return TL_VIEW;
            //    } else {
            //        return TR_VIEW;
            //    }
            //} else {
            //    if (x < $(TL_VIEW).width()) {
            //        return BL_VIEW;
            //    } else {
            //        return BR_VIEW;
            //    }
            //}
        //}
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
        /*
        var id = -1;
        switch (this.getViewUnderMouse(x, y)) {
            case TL_VIEW:
                id = 0;
                break;
            case TR_VIEW:
                id = 1;
                break;
            case BL_VIEW:
                id = 2;
                break;
            case BR_VIEW:
                id = 3;
                break;
        }
        return id;
        */
    }

    setNodeColorInContextMenu = (color: string) => {
        if (this.apps[this.input.activeTarget]) {
            if ((this.input.rightClickLabelAppended) && (this.input.selectedNodeID >= 0)) {
                this.apps[this.input.activeTarget].setANodeColor(this.input.selectedNodeID, '#' + color);
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

            if (this.apps[0]) this.apps[0].highlightSelectedNodes(idArray);
            if (this.apps[1]) this.apps[1].highlightSelectedNodes(idArray);
            if (this.apps[2]) this.apps[2].highlightSelectedNodes(idArray);
            if (this.apps[3]) this.apps[3].highlightSelectedNodes(idArray);
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
            case TR_VIEW: return 1;
            case BL_VIEW: return 2;
            case BR_VIEW: return 3;
            default: return 0;      // tl_view
        }
    }

    applyModelToBrainView = (view: string, model: string, brainSurfaceMode?) => {
        this.resetBrain3D();

        let file = (model === 'ch2') && 'BrainMesh_ch2.obj'
            || (model === 'ch2_inflated') && 'BrainMesh_Ch2_Inflated.obj'
            || (model === 'icbm') && 'BrainMesh_ICBM152.obj'
            || (model === 'ch2_cerebellum') && 'BrainMesh_Ch2withCerebellum.obj'
            || (model === 'upload') && (<any>$('#input-select-model').get(0)).files[0].name
            || "none";

        let id = this.viewToId(view);
        console.log(id, view, $(view));///jm

        this.loadBrainModel(file, object => {
            $(view).empty();
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

            ///jm
            //if (!dataSet) dataSet = new DataSet();
            this.apps[id].setDataSet(this.referenceDataSet);

            var app = this.saveObj.saveApps[id] = (this.loadObj && this.loadObj.saveApps[id]) || new SaveApp(); // create a new instance (if an old instance exists)
            app.surfaceModel = model;
            app.view = view;

            $('#button-save-app').button({ disabled: false });

            if (this.loadObj) {
                // Load dataset into the webapp
                if (this.loadObj.loadExampleData) {
                    this.loadExampleData(app.setDataSetView, view => {
                        this.setDataset(view);
                        this.initApp(id)
                        CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS,
                            "Default example dataset is loaded.");
                    });
                } else {
                    var source = (this.saveObj.loadExampleData ? "save_examples" : "save");
                    this.loadUploadedData(this.loadObj, app.setDataSetView, view => {
                        // Set data set to the right view
                        this.setDataset(view);
                        this.initApp(id);
                        CommonUtilities.launchAlertMessage(CommonUtilities.alertType.SUCCESS,
                            "Uploaded dataset is loaded.");
                    }, source);
                }
            }
        });
    }

    setDataset = (view: string) => {
        this.resetDataSetIcon();
        //TODO: Not actually cloning dataset yet, as the rest of the project isn't ready for it yet. Use clone when basic data structure is fixed, then multiple views is working.

        let id = this.viewToId(view);
        if (!this.referenceDataSet) {
            // Get a dataset from the default example
            this.loadExampleData(view, view => this.apps[id].setDataSet(this.referenceDataSet));
        } else {
            if (!this.referenceDataSet.verify()) return;
            this.apps[id].setDataSet(this.referenceDataSet);
        }
        /*
        if (!this.referenceDataSet) {
            this.loadExampleData(view, view => {
                var clonedDataSet = this.referenceDataSet.clone();
                var appID = -1;
                switch (view) {
                    case TL_VIEW:
                        if (this.apps[0]) this.apps[0].setDataSet(clonedDataSet);
                        appID = 0;
                        break;
                    case TR_VIEW:
                        if (this.apps[1]) this.apps[1].setDataSet(clonedDataSet);
                        appID = 1;
                        break;
                    case BL_VIEW:
                        if (this.apps[2]) this.apps[2].setDataSet(clonedDataSet);
                        appID = 2;
                        break;
                    case BR_VIEW:
                        if (this.apps[3]) this.apps[3].setDataSet(clonedDataSet);
                        appID = 3;
                        break;
                }

                if (appID != -1) {
                    this.saveObj.saveApps[appID].setDataSetView = view;
                }
            });
        } else {
            if (!this.referenceDataSet.verify()) return;
            var clonedDataSet = this.referenceDataSet.clone();
            var appID = -1;
            switch (view) {
                case TL_VIEW:
                    if (this.apps[0]) this.apps[0].setDataSet(clonedDataSet);
                    appID = 0;
                    break;
                case TR_VIEW:
                    if (this.apps[1]) this.apps[1].setDataSet(clonedDataSet);
                    appID = 1;
                    break;
                case BL_VIEW:
                    if (this.apps[2]) this.apps[2].setDataSet(clonedDataSet);
                    appID = 2;
                    break;
                case BR_VIEW:
                    if (this.apps[3]) this.apps[3].setDataSet(clonedDataSet);
                    appID = 3;
                    break;
            }

            if (appID != -1) {
                this.saveObj.saveApps[appID].setDataSetView = view;
            }

        }
        */
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

        } else if (value === "weight") {
            this.commonData.edgeColorMode = "weight";
            $("#div-edge-color-pickers").show();

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
            this.setEdgeColorByNode();
            $("#div-edge-color-pickers").hide();
        }
    }

    // Move an icon back to its origin
    resetBrain3D = () => {
        let rect = $('#brain3d-icon-back').get(0).getBoundingClientRect();
        $('#brain3d-icon-front').css({ left: rect.left, top: rect.top });
    };

    resetDataSetIcon = () => {
        var rect = $('#dataset1-icon-back').get(0).getBoundingClientRect();
        $('#dataset1-icon-front').css({ left: rect.left, top: rect.top });
    };

    // These functions show and hide the icons for all the visualisations - they're called when we change tabs
    showVisIcons = () => {
        this.visIcons.forEach(icon => icon.show());
    }

    hideVisIcons = () => {
        this.visIcons.forEach(icon => icon.hide());
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
        }
        reader.readAsText(file);
    }

    parseCoordinates = (text: string) => {

        //if (!this.referenceDataSet) this.referenceDataSet = new DataSet();

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
        this.commonData.notifyCoords();
    }

    // Load the labels
    loadLabels = file => {
        let reader = new FileReader();
        reader.onload = () => {
            this.parseLabels(reader.result);
        }
        reader.readAsText(file);
    }

    parseLabels = (text: string) => {
        //if (!this.referenceDataSet) this.referenceDataSet = new DataSet();
        this.referenceDataSet.brainLabels = text.replace(/\t|\n|\r/g, ' ').trim().split(' ').map(s => s.trim());
        this.commonData.notifyLabels();
    }

    initSurfaceSettings = () => {
        if (this.loadObj.surfaceSettings.opacity) {
            $("#div-surface-opacity-slider")['bootstrapSlider']().data('bootstrapSlider').setValue(this.loadObj.surfaceSettings.opacity);
            this.setSurfaceOpacity();
        }
    }

    initEdgeSizeAndColor = () => {

        $('select-edge-direction').val(this.loadObj.edgeSettings.directionMode);
        this.setEdgeDirection();

        if (this.loadObj.edgeSettings.colorBy === "none") {
            $('#select-edge-color').val("none");
            this.setEdgeColor();

        } else if (this.loadObj.edgeSettings.colorBy === "node") {
            $('#select-edge-color').val("node");
            this.setEdgeColor();

        } else if (this.loadObj.edgeSettings.colorBy === "weight") {
            $('#select-edge-color').val("weight");
            if (this.loadObj.edgeSettings.weight.type === "continuous-discretized") {
                $('#checkbox-edge-color-discretized').prop('checked', true);
            }

            // make all corresponding elements visible
            this.setEdgeColor();

            if (this.loadObj.edgeSettings.weight.type === "discrete") {
                var setting = this.loadObj.edgeSettings.weight.discreteSetting;
                var keySelection = <any>document.getElementById('select-edge-key');

                for (var i = 0; i < setting.valueArray; i++) {
                    keySelection.options[i].style.backgroundColor = setting.colorArray[i];
                }

            } else if (this.loadObj.edgeSettings.weight.type === "continuous-normal") {
                var setting = this.loadObj.edgeSettings.weight.continuousSetting;

                $('#input-edge-min-color').val(setting.minColor.substring(1));
                $('#input-edge-max-color').val(setting.maxColor.substring(1));

            } else if (this.loadObj.edgeSettings.weight.type === "continuous-discretized") {
                var setting = this.loadObj.edgeSettings.weight.discretizedSetting;

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

            this.setEdgeColorByWeight();
        }
    }

    initNodeSize = () => {
        if ((this.loadObj.nodeSettings.nodeSizeAttribute != null) && (this.loadObj.nodeSettings.nodeSizeAttribute.length > 0)) {
            $('#select-node-size-color').val("node-size");
            $('#select-attribute').val(this.loadObj.nodeSettings.nodeSizeAttribute);
            this.selectNodeSizeColorOnChange();

            $("#div-node-size-slider")['bootstrapSlider']().data('bootstrapSlider').setValue([this.loadObj.nodeSettings.nodeSizeMin, this.loadObj.nodeSettings.nodeSizeMax]);

            $("#label_node_size_range").text(this.loadObj.nodeSettings.nodeSizeMin + " - " + this.loadObj.nodeSettings.nodeSizeMax);

            this.setNodeSizeOrColor();
        }
    }

    initNodeColor = () => {
        if ((this.loadObj.nodeSettings.nodeColorAttribute != null) && (this.loadObj.nodeSettings.nodeColorAttribute.length > 0)) {
            $('#select-node-size-color').val("node-color");
            $('#select-attribute').val(this.loadObj.nodeSettings.nodeColorAttribute);
            this.selectNodeSizeColorOnChange();

            if (this.referenceDataSet.attributes.info[this.loadObj.nodeSettings.nodeColorAttribute].isDiscrete) {
                var keySelection = <any>document.getElementById('select-node-key');

                for (var i = 0; i < keySelection.length; i++) {
                    keySelection.options[i].style.backgroundColor = this.loadObj.nodeSettings.nodeColorDiscrete[i];
                }

                (<any>document.getElementById('input-node-color')).color.fromString(this.loadObj.nodeSettings.nodeColorDiscrete[0].substring(1));

                this.setNodeSizeOrColor();
            }
            else {
                (<any>document.getElementById('input-min-color')).color.fromString(this.loadObj.nodeSettings.nodeColorContinuousMin.substring(1));
                (<any>document.getElementById('input-max-color')).color.fromString(this.loadObj.nodeSettings.nodeColorContinuousMax.substring(1));
                this.setNodeSizeOrColor();
            }
        }
    }

    showLoadingNotification = () => {
        //console.log("function: cursorWait()");
        //$('body').css({ cursor: 'wait' });

        document.body.appendChild(this.divLoadingNotification);
        $('#div-loading-notification').empty(); // empty this.rightClickLabel

        this.divLoadingNotification.style.position = 'absolute';
        this.divLoadingNotification.style.left = '50%';
        this.divLoadingNotification.style.top = '50%';
        this.divLoadingNotification.style.padding = '5px';
        this.divLoadingNotification.style.borderRadius = '2px';
        this.divLoadingNotification.style.zIndex = '1';
        this.divLoadingNotification.style.backgroundColor = '#feeebd'; // the color of the control panel

        var text = document.createElement('div');
        text.innerHTML = "Loading...";
        this.divLoadingNotification.appendChild(text);

        //var button = document.createElement('button');
        //button.textContent = "continue";
        //divLoadingNotification.appendChild(button);
    }

    removeLoadingNotification = () => {
        if ($('#div-loading-notification').length > 0)
            document.body.removeChild(this.divLoadingNotification);
    }

    // Load the brain surface (hardcoded - it is not simple to load geometry from the local machine, but this has not been deeply explored yet).
    // NOTE: The loaded model cannot be used in more than one WebGL context (scene) at a time - the geometry and materials must be .cloned() into
    // new THREE.Mesh() objects by the application wishing to use the model.
    loadBrainModel = (file: string, callback) => {
        this.loader.load('examples/graphdata/' + file, object => {
            //loader.setPath('examples/graphdata/');
            //loader.load(file, function (object) {
            if (!object) {
                CommonUtilities.launchAlertMessage(CommonUtilities.alertType.ERROR, "Failed to load brain surface.");
                return;
            }

            var surfaceColor = parseInt(this.brainSurfaceColor);

            callback(object);
        });
    }

    setBrainSurfaceColor = (color: string) => {
        this.brainSurfaceColor = '0x' + color;
    }

    // Load the similarity matrix for the specified dataSet
    //TODO: Move into DataSet class
    loadSimilarityMatrix = (file, dataSet: DataSet) => {
        var reader = new FileReader();
        reader.onload = () => this.parseSimilarityMatrix(reader.result, dataSet);
        reader.readAsText(file);
    }

    parseSimilarityMatrix = (text: string, dataSet: DataSet) => {
    //TODO: Move into DataSet class
        //if (!dataSet) dataSet = new DataSet();
        //var lines = text.split('\n').map(s => s.trim());
        var lines = text.replace(/\t|\,/g, ' ').trim().split(/\r\n|\r|\n/g).map(s => s.trim());
        var simMatrix = [];
        lines.forEach((line, i) => {
            if (line.length > 0) {
                simMatrix.push(line.split(' ').map(parseFloat));
            }
        })
        dataSet.setSimMatrix(simMatrix);
    }

    // Load the attributes for the specified dataSet
    //TODO: Move into DataSet class
    loadAttributes = (file, dataSet: DataSet) => {
        var reader = new FileReader();
        reader.onload = () => this.parseAttributes(reader.result, dataSet);
        reader.readAsText(file);
    }

    parseAttributes = (text: string, dataSet: DataSet) => {
    //TODO: Move into DataSet class
        //if (!dataSet) dataSet = new DataSet();
        var newAttributes = new Attributes(text);
        dataSet.attributes = newAttributes;
        dataSet.notifyAttributes();
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
        // listener
        let filtered = () => {
            //console.log("filter event...");

            this.referenceDataSet.attributes.filteredRecords = dimArray[0].top(Number.POSITIVE_INFINITY);
            this.referenceDataSet.attributes.filteredRecordsHighlightChanged = true;
            //console.log(dimArray);
            if (this.referenceDataSet.attributes.filteredRecords) {
                //console.log(fcount + "). count: " + this.referenceDataSet.attributes.filteredRecords.length);
                //fcount++; 
            }

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
                .xUnits(25)
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

        $('#button-select-matrix').click(() => $("#select-matrix").click());
        $('#select-matrix').on('change', () => {
            // Change the button name according to the file name
            let file = (<any>$('#select-matrix').get(0)).files[0];
            document.getElementById("button-select-matrix").innerHTML = file.name;

            // update file status to changed
            this.changeFileStatus("matrix-status", "changed");

            // Parse and upload attribute file
            this.uploadMatrix();

        });

        $('#button-select-attrs').click(() => $("#select-attrs").click());

        $('#select-attrs').on('change', () => {
            // Change the button name according to the file name
            var file = (<any>$('#select-attrs').get(0)).files[0];
            document.getElementById("button-select-attrs").innerHTML = file.name;
            // update file status to changed
            this.changeFileStatus("attrs-status", "changed");

            // Parse and upload attribute file
            this.uploadAttr();
        });

        $('#button-select-labels').click(() => $("#select-labels").click());

        $('#select-labels').on('change', () => {
            // Change the button name according to the file name
            var file = (<any>$('#select-labels').get(0)).files[0];
            document.getElementById("button-select-labels").innerHTML = file.name;

            // update file status to changed
            this.changeFileStatus("labels-status", "changed");

            // Parse and upload labels
            this.uploadLabels();
        });
        
        $('#button-load-settings').button().click(() => $("#input-select-load-file").click());

        $('#input-select-load-file').on('change', this.loadSettings);

        $('#button-save-settings').button().click(this.saveSettings);

        $('#button-export-svg').button().click($("#exportModal")["modal"]);

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
            var file = (<any>$('#input-select-model').get(0)).files[0];
            if (file) {
                // 1. upload the file to server
                $("#brain3d-icon-front").html("Loading...");
                $("#brain3d-icon-front").draggable("disable");
                var reader = new FileReader();
                reader.onload = () => {
                    $.post("brain-app/upload.aspx",
                        {
                            fileText: reader.result,
                            fileName: file.name,
                            type: "brain-model"
                        },
                        (data, status) => {
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

        $('#load-example-data').button().click(() => this.loadExampleData(0, view => {}));

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

        $('#select-attribute').on('change', () => {
            var sizeOrColor = $('#select-node-size-color').val();
            var attribute = $('#select-attribute').val();

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
        });

        $('#select-node-key').on('change', () => {
            var key = $('#select-node-key').val();

            var keySelection = <any>document.getElementById('select-node-key');

            for (var i = 0; i < keySelection.length; i++) {
                if (keySelection.options[i].value == key) {
                    var color = keySelection.options[i].style.backgroundColor;
                    var hex = this.colorToHex(color);
                    (<any>document.getElementById('input-node-color')).color.fromString(hex.substring(1));
                    break;
                }
            }
        });

        $('#select-edge-key').on('change', () => {
            var key = $('#select-edge-key').val();

            var keySelection = <any>document.getElementById('select-edge-key');

            // find the coressponding key and retrieve color data
            for (var i = 0; i < keySelection.length; i++) {
                if (keySelection.options[i].value == key) {
                    var color = keySelection.options[i].style.backgroundColor;
                    var hex = this.colorToHex(color);
                    (<any>document.getElementById('input-edge-color')).color.fromString(hex.substring(1));
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

        $('#brain3d-icon-front').draggable(
            <any>{
                containment: 'body',
                stop: event => {
                    var model = $('#select-brain3d-model').val();
                    var view = this.getViewUnderMouse(event.pageX, event.pageY);
                    this.applyModelToBrainView(view, model);
                }
            }
        );

        $('#dataset1-icon-front').draggable(
            <any>{
                containment: 'body',
                stop: event => {
                    var view = this.getViewUnderMouse(event.pageX, event.pageY);
                    this.setDataset(view);
                }
            }
        );
        
        $('#checkbox_yoking_view').on('change', () => {
            if ($('#checkbox_yoking_view').is(":checked")) {
                this.input.yokingView = true;
            }
            else {
                this.input.yokingView = false;
            }
        });

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
            }

            this.resetBrain3D();

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

