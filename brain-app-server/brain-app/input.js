/// <reference path="../extern/three.d.ts"/>
/*
Copyright (c) 2013, Faculty of Information Technology, Monash University.
All rights reserved.
Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of Monash University nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
/*
* Author: Nicholas Smith
*
* This module defines all objects and functions needed to handle input from
* the mouse, keyboard, and Leap Motion and direct them to specific targets.
* A 'target' is usually a sub-application within a browser window.
*
* Please note the Leap motion-related code may be poorly designed and unmaintainable.
*/
// Leap and screen spatial information (to have the location you point at on the screen detected accurately)
var screenAspectRatio = 16 / 9;
var screenSize = 15.6 * 25.4; // mm diagonally
var screenHeight = Math.sqrt(screenSize * screenSize / (screenAspectRatio * screenAspectRatio + 1));
var screenWidth = Math.sqrt(screenSize * screenSize - screenHeight * screenHeight);
var leapDistance = 250; // in mm, from the screen
var leapHeight = 0; //in mm, relative to the bottom of the display
// A reference to an instance of this class is passed to all the input targets so they each have a valid reference to the
// position of the current pointer (the 'ptr' member holds this reference)
var PointerIndirection = (function () {
    function PointerIndirection() {
    }
    return PointerIndirection;
}());
// Holds the state of and the callbacks to be made for a particular input target
var InputTarget = (function () {
    // Accepts the CSS ID of the div that is to represent the input target, and the extra borders
    // which describe where in the div the region of interest is (and where the coordinates should be scaled around)
    function InputTarget(targetCssId, currentPointer, leftBorder, rightBorder, topBorder, bottomBorder) {
        if (leftBorder === void 0) { leftBorder = 0; }
        if (rightBorder === void 0) { rightBorder = 0; }
        if (topBorder === void 0) { topBorder = 0; }
        if (bottomBorder === void 0) { bottomBorder = 0; }
        this.targetCssId = targetCssId;
        this.currentPointer = currentPointer;
        this.leftBorder = leftBorder;
        this.rightBorder = rightBorder;
        this.topBorder = topBorder;
        this.bottomBorder = bottomBorder;
        this.active = false;
        this.sliderEvent = false;
        this.keyDownCallbacks = {};
        this.keyUpCallbacks = {};
        this.keyTickCallbacks = {};
    }
    InputTarget.prototype.regKeyDownCallback = function (key, callback) {
        this.keyDownCallbacks[key] = callback;
    };
    InputTarget.prototype.regKeyUpCallback = function (key, callback) {
        this.keyUpCallbacks[key] = callback;
    };
    InputTarget.prototype.regKeyTickCallback = function (key, callback) {
        this.keyTickCallbacks[key] = callback;
    };
    InputTarget.prototype.regLeapXCallback = function (callback) {
        this.leapXCallback = callback;
    };
    InputTarget.prototype.regLeapYCallback = function (callback) {
        this.leapYCallback = callback;
    };
    InputTarget.prototype.regLeapZCallback = function (callback) {
        this.leapZCallback = callback;
    };
    InputTarget.prototype.regMouseDragCallback = function (callback) {
        this.mouseDragCallback = callback;
    };
    InputTarget.prototype.regMouseRightClickCallback = function (callback) {
        this.mouseRightClickCallback = callback;
    };
    InputTarget.prototype.regMouseLeftClickCallback = function (callback) {
        this.mouseLeftClickCallback = callback;
    };
    InputTarget.prototype.regMouseWheelCallback = function (callback) {
        this.mouseWheelCallback = callback;
    };
    InputTarget.prototype.regMouseDoubleClickCallback = function (callback) {
        this.mouseDoubleClickCallback = callback;
    };
    InputTarget.prototype.regGetRotationCallback = function (callback) {
        this.getRotationCallback = callback;
    };
    InputTarget.prototype.regSetRotationCallback = function (callback) {
        this.setRotationCallback = callback;
    };
    // Return the pointer coordinates within the input target as a pair (x, y) E [-1, 1]x[-1, 1] as they lie within the target's borders
    InputTarget.prototype.localPointerPosition = function () {
        var target = $(this.targetCssId);
        var pos = target.offset();
        return new THREE.Vector2((this.currentPointer.ptr.x - pos.left - this.leftBorder) / (target.width() - this.leftBorder - this.rightBorder) * 2 - 1, (pos.top + this.topBorder - this.currentPointer.ptr.y) / (target.height() - this.topBorder - this.bottomBorder) * 2 + 1);
    };
    return InputTarget;
}());
// Reads input and directs it to the currently-active input target.
var InputTargetManager = (function () {
    // Accepts the CSS IDs of each of the divs that represent an input target, as well as an object that implements the interface for a Leap motion pointer
    function InputTargetManager(targetCssIds, pointerImage) {
        var _this = this;
        this.targetCssIds = targetCssIds;
        this.pointerImage = pointerImage;
        this.mouse = new THREE.Vector2(-999999, -999999);
        this.keyboardKey = {};
        this.activeTarget = 0;
        this.isDragged = false;
        this.fingerPointer = new THREE.Vector2(-999999, -999999); // Vector respresenting the current position of the Leap on the screen
        this.pointingHandID = -1;
        this.pointingHandCheckedIn = false; // Whether the pointing hand was found during the last update
        this.pointingHandLenience = 0; // The grace period left before we consider the pointing hand lost
        this.maxPointingHandLenience = 10;
        this.fingerLostLenience = 0;
        this.maxFingerLostLenience = 10;
        this.fingerSmoothingLevel = 3; // Finger smoothing when pointing
        this.fpi = 0;
        this.yokingView = false;
        this.isMouseDown = false;
        this.onMouseDownPosition = new THREE.Vector2();
        this.rightClickLabelAppended = false;
        this.selectedNodeID = -1;
        this.contextMenuColorChanged = false;
        this.loop = new Loop(this, Number.POSITIVE_INFINITY); // Create a loop object so we can continually make callbacks for held-down keys
        this.currentPointer = new PointerIndirection();
        this.currentPointer.ptr = this.mouse;
        // Create the array to hold the input target objects - we'll create them later when we actually have a div to be targetted
        var numTargets = targetCssIds.length;
        this.inputTargets = new Array(numTargets);
        // Leap controller variables
        this.leap = new Leap.Controller();
        this.leap.on('deviceConnected', function () {
            console.log("The Leap device has been connected.");
        });
        this.leap.on('deviceDisconnected', function () {
            console.log("The Leap device has been disconnected.");
        });
        this.leap.connect();
        // Initialize finger smoothing variables
        this.fingerPositions = new Array(this.fingerSmoothingLevel);
        for (var i = 0; i < this.fingerSmoothingLevel; ++i)
            this.fingerPositions[i] = [1, 1, 1];
        var varYokingViewAcrossPanels = function () { _this.yokingViewAcrossPanels(); };
        this.rightClickLabel = document.createElement('div');
        this.rightClickLabel.id = 'right-click-label';
        document.addEventListener('click', function (event) {
            if (_this.isDragged) {
                _this.isDragged = false;
                return;
            }
            _this.currentPointer.ptr = _this.mouse;
            var it = _this.inputTargets[_this.activeTarget];
            if (it) {
                var dx = event.clientX - _this.mouse.x;
                var dy = event.clientY - _this.mouse.y;
                // left mouse
                if (_this.mouseDownMode == 1) {
                    it.mouseLeftClickCallback(dx, dy);
                }
                if (_this.yokingView)
                    varYokingViewAcrossPanels();
            }
            _this.mouse.x = event.clientX;
            _this.mouse.y = event.clientY;
        }, false);
        document.addEventListener('mousedown', function (event) {
            // Remove label if exists
            if (_this.rightClickLabelAppended) {
                if (((event.target).id != "input-context-menu-node-color") && (_this.contextMenuColorChanged == false)) {
                    document.body.removeChild(_this.rightClickLabel);
                    _this.selectedNodeID = -1;
                    _this.rightClickLabelAppended = false;
                }
            }
            _this.contextMenuColorChanged = false;
            _this.mouseDownMode = event.which;
            var viewID = _this.mouseLocationCallback(event.clientX, event.clientY);
            if (viewID == _this.activeTarget) {
                var it = _this.inputTargets[_this.activeTarget];
                if (it && (it.sliderEvent == true))
                    return;
                _this.isMouseDown = true;
                _this.mouse.x = event.clientX;
                _this.mouse.y = event.clientY;
                _this.onMouseDownPosition.x = event.clientX;
                _this.onMouseDownPosition.y = event.clientY;
            }
        }, false);
        document.addEventListener('contextmenu', function (event) {
            event.preventDefault();
            var record;
            var x, y;
            var it = _this.inputTargets[_this.activeTarget];
            if (it) {
                x = _this.mouse.x;
                y = _this.mouse.y;
                var callback = it.mouseRightClickCallback;
                if (callback)
                    record = callback(x, y);
            }
            if (record) {
                $('#div-context-menu-color-picker').css({ visibility: 'visible' });
                if ($('#div-context-menu-color-picker').length > 0)
                    _this.divContextMenuColorPicker = $('#div-context-menu-color-picker').detach();
                document.body.appendChild(_this.rightClickLabel);
                $('#right-click-label').empty(); // empty this.rightClickLabel
                _this.rightClickLabel.style.position = 'absolute';
                _this.rightClickLabel.style.left = x + 'px';
                _this.rightClickLabel.style.top = y + 'px';
                _this.rightClickLabel.style.padding = '5px';
                _this.rightClickLabel.style.borderRadius = '5px';
                _this.rightClickLabel.style.zIndex = '1';
                _this.rightClickLabel.style.backgroundColor = '#feeebd'; // the color of the control panel
                // the first attribute is node id
                _this.selectedNodeID = record.id;
                // Populate tdhe right click label
                for (var attr in record) {
                    if (record.hasOwnProperty(attr)) {
                        var text = document.createElement('div');
                        text.innerHTML = attr + ": " + record[attr];
                        text.style.marginBottom = '5px';
                        _this.rightClickLabel.appendChild(text);
                    }
                }
                $(_this.divContextMenuColorPicker).appendTo('#right-click-label');
                // the last attribute is color
                var color = parseInt(record.color);
                var hex = color.toString(16);
                document.getElementById('input-context-menu-node-color').color.fromString(hex);
                _this.rightClickLabelAppended = true;
            }
            return false; // disable the context menu
        }, false);
        document.addEventListener('mouseup', function (event) {
            _this.isMouseDown = false;
            setTimeout(_this.mouseUpCallback, 200);
        }, false);
        document.addEventListener('dblclick', function (event) {
            event.preventDefault();
            var viewID = _this.mouseLocationCallback(event.clientX, event.clientY);
            if (viewID == _this.activeTarget) {
                var it = _this.inputTargets[_this.activeTarget];
                if (it) {
                    var callback = it.mouseDoubleClickCallback;
                    if (callback)
                        callback();
                }
            }
        }, false);
        document.addEventListener('mousewheel', function (event) {
            var viewID = _this.mouseLocationCallback(event.clientX, event.clientY);
            if (viewID == _this.activeTarget) {
                var it = _this.inputTargets[_this.activeTarget];
                if (it) {
                    //console.log(event.wheelDelta);
                    var callback = it.mouseWheelCallback;
                    if (callback)
                        callback(-event.wheelDelta / 2000);
                }
            }
        }, false);
        document.addEventListener('mousemove', function (event) {
            _this.currentPointer.ptr = _this.mouse;
            _this.pointerImage.hide();
            if (_this.contextMenuColorChanged)
                return;
            if (_this.isMouseDown === true) {
                _this.isDragged = true;
                var it = _this.inputTargets[_this.activeTarget];
                if (it) {
                    var dx = event.clientX - _this.mouse.x;
                    var dy = event.clientY - _this.mouse.y;
                    var callback = it.mouseDragCallback;
                    if (callback)
                        callback(dx, dy, _this.mouseDownMode);
                    if (_this.yokingView)
                        varYokingViewAcrossPanels();
                }
            }
            _this.mouse.x = event.clientX;
            _this.mouse.y = event.clientY;
        }, false);
        // Keyboard input handling
        //this.keyboard['keyPressed'] = {};
        //this.keyboard['keyReleased'] = {};
        //this.keyboard['keyToggle'] = {};
        document.addEventListener('keydown', function (evt) {
            //evt.preventDefault(); // Don't do browser built-in search with key press
            var k = _this.translateKeycode(evt.keyCode);
            if (!_this.keyboardKey[k]) {
                _this.keyboardKey[k] = true;
                //this.keyboardKeyToggle[k] = !this.keyboardKeyToggle[k];
                //this.keyboardKeyPressed[k] = true;
                // Make the callbacks for the active input target
                var it = _this.inputTargets[_this.activeTarget];
                if (it) {
                    var callback = it.keyDownCallbacks[k];
                    if (callback)
                        callback(false);
                    if (_this.yokingView)
                        varYokingViewAcrossPanels();
                }
            }
        }, false);
        document.addEventListener('keyup', function (evt) {
            var k = _this.translateKeycode(evt.keyCode);
            _this.keyboardKey[k] = false;
            //this.keyboardKeyReleased[k] = true;
            // Make the callbacks for the active input target
            var it = _this.inputTargets[_this.activeTarget];
            if (it) {
                var callback = it.keyUpCallbacks[k];
                if (callback)
                    callback();
            }
        }, false);
    }
    InputTargetManager.prototype.regMouseLocationCallback = function (callback) {
        this.mouseLocationCallback = callback;
    };
    InputTargetManager.prototype.regMouseUpCallback = function (callback) {
        this.mouseUpCallback = callback;
    };
    InputTargetManager.prototype.yokingViewAcrossPanels = function () {
        if (!this.yokingView)
            return;
        var activeInput = this.inputTargets[this.activeTarget];
        if (activeInput) {
            var rotation = null;
            var callback = activeInput.getRotationCallback;
            if (callback)
                rotation = callback();
            if (rotation) {
                for (var i = 0; i < this.inputTargets.length; i++) {
                    if (i != this.activeTarget) {
                        var input = this.inputTargets[i];
                        if (input) {
                            callback = input.setRotationCallback;
                            if (callback)
                                callback(rotation);
                        }
                    }
                }
            }
        }
    };
    InputTargetManager.prototype.translateKeycode = function (code) {
        if (code >= 65 && code < 65 + 26)
            return "abcdefghijklmnopqrstuvwxyz"[code - 65];
        if (code >= 48 && code < 48 + 10)
            return "0123456789"[code - 48];
        if (code >= 37 && code <= 40)
            return "AWDS"[code - 37];
        if (code == 32)
            return ' ';
        if (code == 27)
            return 0x1B;
        if (code == 192)
            return '`';
        if (code == 13)
            return '\n';
        if (code == 59)
            return ';';
        if (code == 61)
            return '=';
        if (code == 173)
            return '-';
        return code;
    };
    InputTargetManager.prototype.update = function (deltaTime) {
        var _this = this;
        // Make callbacks for keys held down
        Object.keys(this.keyboardKey).forEach(function (key) {
            if (_this.keyboardKey[key]) {
                var it = _this.inputTargets[_this.activeTarget];
                if (it) {
                    var callback = it.keyTickCallbacks[key];
                    if (callback)
                        callback(deltaTime);
                    if (_this.yokingView)
                        _this.yokingViewAcrossPanels();
                }
            }
        });
        // Gets the position of the finger on the screen in pixels from the top-left corner.
        var getFingerOnScreen = function (finger) {
            var pos = finger.tipPosition.slice(0);
            var dir = finger.direction;
            // Get the position of the finger tip relative to screen centre
            pos[1] += leapHeight - screenHeight / 2;
            pos[2] += leapDistance;
            // Follow finger tip over to screen surface
            var factor = -pos[2] / dir[2];
            pos[0] += dir[0] * factor;
            pos[1] += dir[1] * factor;
            pos[2] += dir[2] * factor;
            // pos[0] & pos[1] are now mm from screen centre
            // Calculate the pointing position on the screen in pixels from the top left (same format as mouse)
            _this.fingerPositions[_this.fpi] = [(pos[0] + (0.5 * screenWidth)) / screenWidth * window.innerWidth, (-pos[1] + (0.5 * screenHeight)) / screenHeight * window.innerHeight];
            _this.fpi = (_this.fpi + 1) % _this.fingerSmoothingLevel;
            var smoothed = averageOfVectors(_this.fingerPositions, _this.fingerSmoothingLevel);
            var coords = new THREE.Vector2();
            coords.x = smoothed[0];
            coords.y = smoothed[1];
            return coords;
        };
        // Works out the gestures currently being performed by the given hand
        var checkHandInput = function (hand) {
            var fingers = hand.fingers;
            if (fingers.length === 1) {
                _this.currentPointer.ptr = _this.fingerPointer;
                _this.pointerImage.show();
                // Try and claim this hand as the pointing hand
                if (_this.pointingHandID === -1) {
                    _this.pointingHandID = hand.id;
                }
                if (_this.pointingHandID === hand.id) {
                    _this.pointingHandCheckedIn = true;
                    if (_this.fingerPointer.id !== fingers[0].id) {
                        // Give a few frames slack if we can't find the finger we had before
                        if (_this.fingerLostLenience > 0) {
                            --_this.fingerLostLenience;
                            return;
                        }
                        else {
                            _this.fingerPointer.id = fingers[0].id;
                        }
                    }
                    _this.fingerLostLenience = _this.maxFingerLostLenience;
                    _this.fingerPointer.copy(getFingerOnScreen(fingers[0]));
                    _this.pointerImage.updatePosition(_this.fingerPointer);
                }
            }
            else if (_this.pointingHandID === hand.id && fingers.length === 2) {
                // If we see two fingers but one is the finger we were already tracking,
                // ignore the second finger.
                _this.pointingHandCheckedIn = true;
                if (fingers[0].id === _this.fingerPointer.id) {
                    _this.fingerPointer.copy(getFingerOnScreen(fingers[0]));
                }
                else if (fingers[1].id === _this.fingerPointer.id) {
                    _this.fingerPointer.copy(getFingerOnScreen(fingers[1]));
                }
            }
            if (_this.pointingHandID === -1) {
                if (hands.length === 1 && fingers.length >= 4) {
                    // Make callbacks for hand motion
                    var t = hand.translation(_this.leap.frame(1));
                    if (t[0] != 0) {
                        var it = _this.inputTargets[_this.activeTarget];
                        if (it) {
                            if (it.leapXCallback)
                                it.leapXCallback(t[0]);
                        }
                    }
                    if (t[1] != 0) {
                        var it = _this.inputTargets[_this.activeTarget];
                        if (it) {
                            if (it.leapYCallback)
                                it.leapYCallback(t[1]);
                        }
                    }
                    if (t[2] != 0) {
                        var it = _this.inputTargets[_this.activeTarget];
                        if (it) {
                            if (it.leapZCallback)
                                it.leapZCallback(t[2]);
                        }
                    }
                }
            }
            /*
            else if (this.pointingHandID !== hand.id) {
                this.grabbingHandCheckedIn = true;
                if (this.grabWarmup === -1) {
                    if (fingers.length < 2) {
                        this.grabWarmup = this.maxGrabWarmup;
                    }
                }
                else if (fingers.length >= 4) {
                    releaseGrab();
                    this.grabWarmup = -1;
                }
                else if (grabWarmup > 0) {
                    this.grabWarmup -= deltaTime;
                }
                else if (this.grabWarmup !== -2) {
                    this.grabWarmup = -2;
                    selectWithCurrentPointer();
                }
            }
            */
        };
        // Check for hand motions and gestures
        var hands = this.leap.frame(0).hands;
        if (hands.length > 0) {
            checkHandInput(hands[0]);
            if (hands.length > 1)
                checkHandInput(hands[1]);
        }
        // Missing hands (or missing gestures) are addressed here,
        // with a grace period for their return
        if (this.pointingHandID !== -1) {
            if (!this.pointingHandCheckedIn) {
                --this.pointingHandLenience;
                if (this.pointingHandLenience < 0) {
                    this.pointingHandID = -1;
                }
            }
            else
                this.pointingHandLenience = this.maxPointingHandLenience;
        }
        this.pointingHandCheckedIn = false;
        //this.grabbingHandCheckedIn = false;
    };
    InputTargetManager.prototype.setActiveTarget = function (index) {
        this.activeTarget = index;
    };
    // Return a function that can be used to create a new input target with the specified border sizes.
    // This is intended to be passed to an application so they can set their own borders.
    InputTargetManager.prototype.newTarget = function (index) {
        var _this = this;
        return function (leftBorder, rightBorder, topBorder, bottomBorder) {
            if (leftBorder === void 0) { leftBorder = 0; }
            if (rightBorder === void 0) { rightBorder = 0; }
            if (topBorder === void 0) { topBorder = 0; }
            if (bottomBorder === void 0) { bottomBorder = 0; }
            // Create the input target and return it
            return _this.inputTargets[index] = new InputTarget(_this.targetCssIds[index], _this.currentPointer, leftBorder, rightBorder, topBorder, bottomBorder);
        };
    };
    return InputTargetManager;
}());
function averageOfVectors(vectors, numVectors) {
    var result = new Array();
    for (var i = 0; i < vectors[0].length; ++i) {
        result[i] = 0;
        for (var j = 0; j < numVectors; ++j)
            result[i] += vectors[j][i];
        result[i] /= numVectors;
    }
    return result;
}
/*
function clearSelection() {
    if (document.selection && document.selection.empty) {
        document.selection.empty();
    } else if (window.getSelection) {
        var sel = window.getSelection();
        sel.removeAllRanges();
    }
}
*/ 
