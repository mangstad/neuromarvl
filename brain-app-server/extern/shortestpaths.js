///<reference path="pqueue.ts"/>
/**
 * @module shortestpaths
 */
var cola;
(function (cola) {
    var shortestpaths;
    (function (shortestpaths) {
        var Neighbour = (function () {
            function Neighbour(id, distance) {
                this.id = id;
                this.distance = distance;
            }
            return Neighbour;
        }());
        var Node = (function () {
            function Node(id) {
                this.id = id;
                this.neighbours = [];
            }
            return Node;
        }());
        /**
         * calculates all-pairs shortest paths or shortest paths from a single node
         * @class Calculator
         * @constructor
         * @param n {number} number of nodes
         * @param es {Edge[]} array of edges
         */
        var Calculator = (function () {
            function Calculator(n, es, getSourceIndex, getTargetIndex, getLength) {
                this.n = n;
                this.es = es;
                this.neighbours = new Array(this.n);
                var i = this.n;
                while (i--)
                    this.neighbours[i] = new Node(i);
                i = this.es.length;
                while (i--) {
                    var e = this.es[i];
                    var u = getSourceIndex(e), v = getTargetIndex(e);
                    var d = getLength(e);
                    this.neighbours[u].neighbours.push(new Neighbour(v, d));
                    this.neighbours[v].neighbours.push(new Neighbour(u, d));
                }
            }
            /**
             * compute shortest paths for graph over n nodes with edges an array of source/target pairs
             * edges may optionally have a length attribute.  1 is the default.
             * Uses Johnson's algorithm.
             *
             * @method DistanceMatrix
             * @return the distance matrix
             */
            Calculator.prototype.DistanceMatrix = function () {
                var D = new Array(this.n);
                for (var i = 0; i < this.n; ++i) {
                    D[i] = this.dijkstraNeighbours(i);
                }
                return D;
            };
            /**
             * get shortest paths from a specified start node
             * @method DistancesFromNode
             * @param start node index
             * @return array of path lengths
             */
            Calculator.prototype.DistancesFromNode = function (start) {
                return this.dijkstraNeighbours(start);
            };
            Calculator.prototype.PathFromNodeToNode = function (start, end) {
                return this.dijkstraNeighbours(start, end);
            };
            Calculator.prototype.dijkstraNeighbours = function (start, dest) {
                if (dest === void 0) { dest = -1; }
                var q = new PriorityQueue(function (a, b) { return a.d <= b.d; }), i = this.neighbours.length, d = new Array(i);
                while (i--) {
                    var node = this.neighbours[i];
                    node.d = i === start ? 0 : Number.POSITIVE_INFINITY;
                    node.q = q.push(node);
                }
                while (!q.empty()) {
                    // console.log(q.toString(function (u) { return u.id + "=" + (u.d === Number.POSITIVE_INFINITY ? "\u221E" : u.d.toFixed(2) )}));
                    var u = q.pop();
                    d[u.id] = u.d;
                    if (u.id === dest) {
                        var path = [];
                        var v = u;
                        while (typeof v.prev !== 'undefined') {
                            path.push(v.prev.id);
                            v = v.prev;
                        }
                        return path;
                    }
                    i = u.neighbours.length;
                    while (i--) {
                        var neighbour = u.neighbours[i];
                        var v = this.neighbours[neighbour.id];
                        var t = u.d + neighbour.distance;
                        if (u.d !== Number.MAX_VALUE && v.d > t) {
                            v.d = t;
                            v.prev = u;
                            q.reduceKey(v.q, v, function (e, q) { return e.q = q; });
                        }
                    }
                }
                return d;
            };
            return Calculator;
        }());
        shortestpaths.Calculator = Calculator;
    })(shortestpaths = cola.shortestpaths || (cola.shortestpaths = {}));
})(cola || (cola = {}));
