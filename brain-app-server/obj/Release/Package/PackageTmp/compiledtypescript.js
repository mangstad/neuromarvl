var cola;
(function (cola) {
    var Locks = (function () {
        function Locks() {
            this.locks = {};
        }
        Locks.prototype.add = function (id, x) {
            if (isNaN(x[0]) || isNaN(x[1]))
                debugger;
            this.locks[id] = x;
        };

        Locks.prototype.clear = function () {
            this.locks = {};
        };

        Locks.prototype.isEmpty = function () {
            for (var l in this.locks)
                return false;
            return true;
        };

        Locks.prototype.apply = function (f) {
            for (var l in this.locks) {
                f(l, this.locks[l]);
            }
        };
        return Locks;
    })();
    cola.Locks = Locks;

    var Descent = (function () {
        function Descent(x, D, G) {
            if (typeof G === "undefined") { G = null; }
            this.D = D;
            this.G = G;
            this.threshold = 0.0001;
            this.random = new PseudoRandom();
            this.project = null;
            this.x = x;
            this.k = x.length;
            var n = this.n = x[0].length;
            this.H = new Array(this.k);
            this.g = new Array(this.k);
            this.Hd = new Array(this.k);
            this.a = new Array(this.k);
            this.b = new Array(this.k);
            this.c = new Array(this.k);
            this.d = new Array(this.k);
            this.e = new Array(this.k);
            this.ia = new Array(this.k);
            this.ib = new Array(this.k);
            this.xtmp = new Array(this.k);
            this.locks = new Locks();
            this.minD = Number.MAX_VALUE;
            var i = n, j;
            while (i--) {
                j = n;
                while (--j > i) {
                    var d = D[i][j];
                    if (d > 0 && d < this.minD) {
                        this.minD = d;
                    }
                }
            }
            if (this.minD === Number.MAX_VALUE)
                this.minD = 1;
            i = this.k;
            while (i--) {
                this.g[i] = new Array(n);
                this.H[i] = new Array(n);
                j = n;
                while (j--) {
                    this.H[i][j] = new Array(n);
                }
                this.Hd[i] = new Array(n);
                this.a[i] = new Array(n);
                this.b[i] = new Array(n);
                this.c[i] = new Array(n);
                this.d[i] = new Array(n);
                this.e[i] = new Array(n);
                this.ia[i] = new Array(n);
                this.ib[i] = new Array(n);
                this.xtmp[i] = new Array(n);
            }
        }
        Descent.createSquareMatrix = function (n, f) {
            var M = new Array(n);
            for (var i = 0; i < n; ++i) {
                M[i] = new Array(n);
                for (var j = 0; j < n; ++j) {
                    M[i][j] = f(i, j);
                }
            }
            return M;
        };

        Descent.prototype.offsetDir = function () {
            var _this = this;
            var u = new Array(this.k);
            var l = 0;
            for (var i = 0; i < this.k; ++i) {
                var x = u[i] = this.random.getNextBetween(0.01, 1) - 0.5;
                l += x * x;
            }
            l = Math.sqrt(l);
            return u.map(function (x) {
                return x *= _this.minD / l;
            });
        };

        Descent.prototype.computeDerivatives = function (x) {
            var _this = this;
            var n = this.n;
            if (n < 1)
                return;
            var i;

            var d = new Array(this.k);
            var d2 = new Array(this.k);
            var Huu = new Array(this.k);
            var maxH = 0;
            for (var u = 0; u < n; ++u) {
                for (i = 0; i < this.k; ++i)
                    Huu[i] = this.g[i][u] = 0;
                for (var v = 0; v < n; ++v) {
                    if (u === v)
                        continue;
                    while (true) {
                        var sd2 = 0;
                        for (i = 0; i < this.k; ++i) {
                            var dx = d[i] = x[i][u] - x[i][v];
                            sd2 += d2[i] = dx * dx;
                        }
                        if (sd2 > 1e-9)
                            break;
                        var rd = this.offsetDir();
                        for (i = 0; i < this.k; ++i)
                            x[i][v] += rd[i];
                    }
                    var l = Math.sqrt(sd2);
                    var D = this.D[u][v];
                    var weight = this.G != null ? this.G[u][v] : 1;
                    if (weight > 1 && l > D || !isFinite(D)) {
                        for (i = 0; i < this.k; ++i)
                            this.H[i][u][v] = 0;
                        continue;
                    }
                    if (weight > 1) {
                        weight = 1;
                    }
                    var D2 = D * D;
                    var gs = weight * (l - D) / (D2 * l);
                    var hs = -weight / (D2 * l * l * l);
                    if (!isFinite(gs))
                        console.log(gs);
                    for (i = 0; i < this.k; ++i) {
                        this.g[i][u] += d[i] * gs;
                        Huu[i] -= this.H[i][u][v] = hs * (D * (d2[i] - sd2) + l * sd2);
                    }
                }
                for (i = 0; i < this.k; ++i)
                    maxH = Math.max(maxH, this.H[i][u][u] = Huu[i]);
            }
            if (!this.locks.isEmpty()) {
                this.locks.apply(function (u, p) {
                    for (i = 0; i < _this.k; ++i) {
                        _this.H[i][u][u] += maxH;
                        _this.g[i][u] -= maxH * (p[i] - x[i][u]);
                    }
                });
            }
        };

        Descent.dotProd = function (a, b) {
            var x = 0, i = a.length;
            while (i--)
                x += a[i] * b[i];
            return x;
        };

        Descent.rightMultiply = function (m, v, r) {
            var i = m.length;
            while (i--)
                r[i] = Descent.dotProd(m[i], v);
        };

        Descent.prototype.computeStepSize = function (d) {
            var numerator = 0, denominator = 0;
            for (var i = 0; i < 2; ++i) {
                numerator += Descent.dotProd(this.g[i], d[i]);
                Descent.rightMultiply(this.H[i], d[i], this.Hd[i]);
                denominator += Descent.dotProd(d[i], this.Hd[i]);
            }
            if (denominator === 0 || !isFinite(denominator))
                return 0;
            return numerator / denominator;
        };

        Descent.prototype.reduceStress = function () {
            this.computeDerivatives(this.x);
            var alpha = this.computeStepSize(this.g);
            for (var i = 0; i < this.k; ++i) {
                this.takeDescentStep(this.x[i], this.g[i], alpha);
            }
            return this.computeStress();
        };

        Descent.copy = function (a, b) {
            var m = a.length, n = b[0].length;
            for (var i = 0; i < m; ++i) {
                for (var j = 0; j < n; ++j) {
                    b[i][j] = a[i][j];
                }
            }
        };

        Descent.prototype.stepAndProject = function (x0, r, d, stepSize) {
            Descent.copy(x0, r);
            this.takeDescentStep(r[0], d[0], stepSize);
            if (this.project)
                this.project[0](x0[0], x0[1], r[0]);
            this.takeDescentStep(r[1], d[1], stepSize);
            if (this.project)
                this.project[1](r[0], x0[1], r[1]);
        };

        Descent.mApply = function (m, n, f) {
            var i = m;
            while (i-- > 0) {
                var j = n;
                while (j-- > 0)
                    f(i, j);
            }
        };
        Descent.prototype.matrixApply = function (f) {
            Descent.mApply(this.k, this.n, f);
        };

        Descent.prototype.computeNextPosition = function (x0, r) {
            var _this = this;
            this.computeDerivatives(x0);
            var alpha = this.computeStepSize(this.g);
            this.stepAndProject(x0, r, this.g, alpha);

            for (var u = 0; u < this.n; ++u)
                for (var i = 0; i < this.k; ++i)
                    if (isNaN(r[i][u]))
                        debugger;

            if (this.project) {
                this.matrixApply(function (i, j) {
                    return _this.e[i][j] = x0[i][j] - r[i][j];
                });
                var beta = this.computeStepSize(this.e);
                beta = Math.max(0.2, Math.min(beta, 1));
                this.stepAndProject(x0, r, this.e, beta);
            }
        };

        Descent.prototype.run = function (iterations) {
            var stress = Number.MAX_VALUE, converged = false;
            while (!converged && iterations-- > 0) {
                var s = this.rungeKutta();
                converged = Math.abs(stress / s - 1) < this.threshold;
                stress = s;
            }
            return stress;
        };

        Descent.prototype.rungeKutta = function () {
            var _this = this;
            this.computeNextPosition(this.x, this.a);
            Descent.mid(this.x, this.a, this.ia);
            this.computeNextPosition(this.ia, this.b);
            Descent.mid(this.x, this.b, this.ib);
            this.computeNextPosition(this.ib, this.c);
            this.computeNextPosition(this.c, this.d);
            var disp = 0;
            this.matrixApply(function (i, j) {
                var x = (_this.a[i][j] + 2.0 * _this.b[i][j] + 2.0 * _this.c[i][j] + _this.d[i][j]) / 6.0, d = _this.x[i][j] - x;
                disp += d * d;
                _this.x[i][j] = x;
            });
            return disp;
        };

        Descent.mid = function (a, b, m) {
            Descent.mApply(a.length, a[0].length, function (i, j) {
                return m[i][j] = a[i][j] + (b[i][j] - a[i][j]) / 2.0;
            });
        };

        Descent.prototype.takeDescentStep = function (x, d, stepSize) {
            for (var i = 0; i < this.n; ++i) {
                x[i] = x[i] - stepSize * d[i];
            }
        };

        Descent.prototype.computeStress = function () {
            var stress = 0;
            for (var u = 0, nMinus1 = this.n - 1; u < nMinus1; ++u) {
                for (var v = u + 1, n = this.n; v < n; ++v) {
                    var l = 0;
                    for (var i = 0; i < this.k; ++i) {
                        var dx = this.x[i][u] - this.x[i][v];
                        l += dx * dx;
                    }
                    l = Math.sqrt(l);
                    var d = this.D[u][v];
                    if (!isFinite(d))
                        continue;
                    var rl = d - l;
                    var d2 = d * d;
                    stress += rl * rl / d2;
                }
            }
            return stress;
        };
        Descent.zeroDistance = 1e-10;
        return Descent;
    })();
    cola.Descent = Descent;

    var PseudoRandom = (function () {
        function PseudoRandom(seed) {
            if (typeof seed === "undefined") { seed = 1; }
            this.seed = seed;
            this.a = 214013;
            this.c = 2531011;
            this.m = 2147483648;
            this.range = 32767;
        }
        PseudoRandom.prototype.getNext = function () {
            this.seed = (this.seed * this.a + this.c) % this.m;
            return (this.seed >> 16) / this.range;
        };

        PseudoRandom.prototype.getNextBetween = function (min, max) {
            return min + this.getNext() * (max - min);
        };
        return PseudoRandom;
    })();
    cola.PseudoRandom = PseudoRandom;
})(cola || (cola = {}));
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var cola;
(function (cola) {
    (function (geom) {
        var Point = (function () {
            function Point() {
            }
            return Point;
        })();
        geom.Point = Point;

        var LineSegment = (function () {
            function LineSegment(x1, y1, x2, y2) {
                this.x1 = x1;
                this.y1 = y1;
                this.x2 = x2;
                this.y2 = y2;
            }
            return LineSegment;
        })();
        geom.LineSegment = LineSegment;

        var PolyPoint = (function (_super) {
            __extends(PolyPoint, _super);
            function PolyPoint() {
                _super.apply(this, arguments);
            }
            return PolyPoint;
        })(Point);
        geom.PolyPoint = PolyPoint;

        function isLeft(P0, P1, P2) {
            return (P1.x - P0.x) * (P2.y - P0.y) - (P2.x - P0.x) * (P1.y - P0.y);
        }
        geom.isLeft = isLeft;

        function above(p, vi, vj) {
            return isLeft(p, vi, vj) > 0;
        }

        function below(p, vi, vj) {
            return isLeft(p, vi, vj) < 0;
        }

        function ConvexHull(S) {
            var P = S.slice(0).sort(function (a, b) {
                return a.x !== b.x ? b.x - a.x : b.y - a.y;
            });
            var n = S.length, i;
            var minmin = 0;
            var xmin = P[0].x;
            for (i = 1; i < n; ++i) {
                if (P[i].x !== xmin)
                    break;
            }
            var minmax = i - 1;
            var H = [];
            H.push(P[minmin]);
            if (minmax === n - 1) {
                if (P[minmax].y !== P[minmin].y)
                    H.push(P[minmax]);
            } else {
                var maxmin, maxmax = n - 1;
                var xmax = P[n - 1].x;
                for (i = n - 2; i >= 0; i--)
                    if (P[i].x !== xmax)
                        break;
                maxmin = i + 1;

                i = minmax;
                while (++i <= maxmin) {
                    if (isLeft(P[minmin], P[maxmin], P[i]) >= 0 && i < maxmin)
                        continue;

                    while (H.length > 1) {
                        if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                            break;
                        else
                            H.length -= 1;
                    }
                    if (i != minmin)
                        H.push(P[i]);
                }

                if (maxmax != maxmin)
                    H.push(P[maxmax]);
                var bot = H.length;
                i = maxmin;
                while (--i >= minmax) {
                    if (isLeft(P[maxmax], P[minmax], P[i]) >= 0 && i > minmax)
                        continue;

                    while (H.length > bot) {
                        if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                            break;
                        else
                            H.length -= 1;
                    }
                    if (i != minmin)
                        H.push(P[i]);
                }
            }
            return H;
        }
        geom.ConvexHull = ConvexHull;

        function clockwiseRadialSweep(p, P, f) {
            P.slice(0).sort(function (a, b) {
                return Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x);
            }).forEach(f);
        }
        geom.clockwiseRadialSweep = clockwiseRadialSweep;

        function nextPolyPoint(p, ps) {
            if (p.polyIndex === ps.length - 1)
                return ps[0];
            return ps[p.polyIndex + 1];
        }

        function prevPolyPoint(p, ps) {
            if (p.polyIndex === 0)
                return ps[ps.length - 1];
            return ps[p.polyIndex - 1];
        }

        function tangent_PointPolyC(P, V) {
            return { rtan: Rtangent_PointPolyC(P, V), ltan: Ltangent_PointPolyC(P, V) };
        }

        function Rtangent_PointPolyC(P, V) {
            var n = V.length - 1;

            var a, b, c;
            var upA, dnC;

            if (below(P, V[1], V[0]) && !above(P, V[n - 1], V[0]))
                return 0;

            for (a = 0, b = n; ;) {
                if (b - a === 1)
                    if (above(P, V[a], V[b]))
                        return a;
                    else
                        return b;

                c = Math.floor((a + b) / 2);
                dnC = below(P, V[c + 1], V[c]);
                if (dnC && !above(P, V[c - 1], V[c]))
                    return c;

                upA = above(P, V[a + 1], V[a]);
                if (upA) {
                    if (dnC)
                        b = c;
                    else {
                        if (above(P, V[a], V[c]))
                            b = c;
                        else
                            a = c;
                    }
                } else {
                    if (!dnC)
                        a = c;
                    else {
                        if (below(P, V[a], V[c]))
                            b = c;
                        else
                            a = c;
                    }
                }
            }
        }

        function Ltangent_PointPolyC(P, V) {
            var n = V.length - 1;

            var a, b, c;
            var dnA, dnC;

            if (above(P, V[n - 1], V[0]) && !below(P, V[1], V[0]))
                return 0;

            for (a = 0, b = n; ;) {
                if (b - a === 1)
                    if (below(P, V[a], V[b]))
                        return a;
                    else
                        return b;

                c = Math.floor((a + b) / 2);
                dnC = below(P, V[c + 1], V[c]);
                if (above(P, V[c - 1], V[c]) && !dnC)
                    return c;

                dnA = below(P, V[a + 1], V[a]);
                if (dnA) {
                    if (!dnC)
                        b = c;
                    else {
                        if (below(P, V[a], V[c]))
                            b = c;
                        else
                            a = c;
                    }
                } else {
                    if (dnC)
                        a = c;
                    else {
                        if (above(P, V[a], V[c]))
                            b = c;
                        else
                            a = c;
                    }
                }
            }
        }

        function tangent_PolyPolyC(V, W, t1, t2, cmp1, cmp2) {
            var ix1, ix2;

            ix1 = t1(W[0], V);
            ix2 = t2(V[ix1], W);

            var done = false;
            while (!done) {
                done = true;
                while (true) {
                    if (ix1 === V.length - 1)
                        ix1 = 0;
                    if (cmp1(W[ix2], V[ix1], V[ix1 + 1]))
                        break;
                    ++ix1;
                }
                while (true) {
                    if (ix2 === 0)
                        ix2 = W.length - 1;
                    if (cmp2(V[ix1], W[ix2], W[ix2 - 1]))
                        break;
                    --ix2;
                    done = false;
                }
            }
            return { t1: ix1, t2: ix2 };
        }
        geom.tangent_PolyPolyC = tangent_PolyPolyC;

        function LRtangent_PolyPolyC(V, W) {
            var rl = RLtangent_PolyPolyC(W, V);
            return { t1: rl.t2, t2: rl.t1 };
        }
        geom.LRtangent_PolyPolyC = LRtangent_PolyPolyC;

        function RLtangent_PolyPolyC(V, W) {
            return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Ltangent_PointPolyC, above, below);
        }
        geom.RLtangent_PolyPolyC = RLtangent_PolyPolyC;

        function LLtangent_PolyPolyC(V, W) {
            return tangent_PolyPolyC(V, W, Ltangent_PointPolyC, Ltangent_PointPolyC, below, below);
        }
        geom.LLtangent_PolyPolyC = LLtangent_PolyPolyC;

        function RRtangent_PolyPolyC(V, W) {
            return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Rtangent_PointPolyC, above, above);
        }
        geom.RRtangent_PolyPolyC = RRtangent_PolyPolyC;

        var BiTangent = (function () {
            function BiTangent(t1, t2) {
                this.t1 = t1;
                this.t2 = t2;
            }
            return BiTangent;
        })();
        geom.BiTangent = BiTangent;

        var BiTangents = (function () {
            function BiTangents() {
            }
            return BiTangents;
        })();
        geom.BiTangents = BiTangents;

        var TVGPoint = (function (_super) {
            __extends(TVGPoint, _super);
            function TVGPoint() {
                _super.apply(this, arguments);
            }
            return TVGPoint;
        })(Point);
        geom.TVGPoint = TVGPoint;

        var VisibilityVertex = (function () {
            function VisibilityVertex(id, polyid, polyvertid, p) {
                this.id = id;
                this.polyid = polyid;
                this.polyvertid = polyvertid;
                this.p = p;
                p.vv = this;
            }
            return VisibilityVertex;
        })();
        geom.VisibilityVertex = VisibilityVertex;

        var VisibilityEdge = (function () {
            function VisibilityEdge(source, target) {
                this.source = source;
                this.target = target;
            }
            VisibilityEdge.prototype.length = function () {
                var dx = this.source.p.x - this.target.p.x;
                var dy = this.source.p.y - this.target.p.y;
                return Math.sqrt(dx * dx + dy * dy);
            };
            return VisibilityEdge;
        })();
        geom.VisibilityEdge = VisibilityEdge;

        var TangentVisibilityGraph = (function () {
            function TangentVisibilityGraph(P, g0) {
                this.P = P;
                this.V = [];
                this.E = [];
                if (!g0) {
                    var n = P.length;
                    for (var i = 0; i < n; i++) {
                        var p = P[i];
                        for (var j = 0; j < p.length; ++j) {
                            var pj = p[j], vv = new VisibilityVertex(this.V.length, i, j, pj);
                            this.V.push(vv);
                            if (j > 0)
                                this.E.push(new VisibilityEdge(p[j - 1].vv, vv));
                        }
                    }
                    for (var i = 0; i < n - 1; i++) {
                        var Pi = P[i];
                        for (var j = i + 1; j < n; j++) {
                            var Pj = P[j], t = geom.tangents(Pi, Pj);
                            for (var q in t) {
                                var c = t[q], source = Pi[c.t1], target = Pj[c.t2];
                                this.addEdgeIfVisible(source, target, i, j);
                            }
                        }
                    }
                } else {
                    this.V = g0.V.slice(0);
                    this.E = g0.E.slice(0);
                }
            }
            TangentVisibilityGraph.prototype.addEdgeIfVisible = function (u, v, i1, i2) {
                if (!this.intersectsPolys(new LineSegment(u.x, u.y, v.x, v.y), i1, i2)) {
                    this.E.push(new VisibilityEdge(u.vv, v.vv));
                }
            };
            TangentVisibilityGraph.prototype.addPoint = function (p, i1) {
                var n = this.P.length;
                this.V.push(new VisibilityVertex(this.V.length, n, 0, p));
                for (var i = 0; i < n; ++i) {
                    if (i === i1)
                        continue;
                    var poly = this.P[i], t = tangent_PointPolyC(p, poly);
                    this.addEdgeIfVisible(p, poly[t.ltan], i1, i);
                    this.addEdgeIfVisible(p, poly[t.rtan], i1, i);
                }
                return p.vv;
            };
            TangentVisibilityGraph.prototype.intersectsPolys = function (l, i1, i2) {
                for (var i = 0, n = this.P.length; i < n; ++i) {
                    if (i != i1 && i != i2 && intersects(l, this.P[i]).length > 0) {
                        return true;
                    }
                }
                return false;
            };
            return TangentVisibilityGraph;
        })();
        geom.TangentVisibilityGraph = TangentVisibilityGraph;

        function intersects(l, P) {
            var ints = [];
            for (var i = 1, n = P.length; i < n; ++i) {
                var int = cola.vpsc.Rectangle.lineIntersection(l.x1, l.y1, l.x2, l.y2, P[i - 1].x, P[i - 1].y, P[i].x, P[i].y);
                if (int)
                    ints.push(int);
            }
            return ints;
        }

        function tangents(V, W) {
            var m = V.length - 1, n = W.length - 1;
            var bt = new BiTangents();
            for (var i = 0; i < m; ++i) {
                for (var j = 0; j < n; ++j) {
                    var v1 = V[i == 0 ? m - 1 : i - 1];
                    var v2 = V[i];
                    var v3 = V[i + 1];
                    var w1 = W[j == 0 ? n - 1 : j - 1];
                    var w2 = W[j];
                    var w3 = W[j + 1];
                    var v1v2w2 = isLeft(v1, v2, w2);
                    var v2w1w2 = isLeft(v2, w1, w2);
                    var v2w2w3 = isLeft(v2, w2, w3);
                    var w1w2v2 = isLeft(w1, w2, v2);
                    var w2v1v2 = isLeft(w2, v1, v2);
                    var w2v2v3 = isLeft(w2, v2, v3);
                    if (v1v2w2 >= 0 && v2w1w2 >= 0 && v2w2w3 < 0 && w1w2v2 >= 0 && w2v1v2 >= 0 && w2v2v3 < 0) {
                        bt.ll = new BiTangent(i, j);
                    } else if (v1v2w2 <= 0 && v2w1w2 <= 0 && v2w2w3 > 0 && w1w2v2 <= 0 && w2v1v2 <= 0 && w2v2v3 > 0) {
                        bt.rr = new BiTangent(i, j);
                    } else if (v1v2w2 <= 0 && v2w1w2 > 0 && v2w2w3 <= 0 && w1w2v2 >= 0 && w2v1v2 < 0 && w2v2v3 >= 0) {
                        bt.rl = new BiTangent(i, j);
                    } else if (v1v2w2 >= 0 && v2w1w2 < 0 && v2w2w3 >= 0 && w1w2v2 <= 0 && w2v1v2 > 0 && w2v2v3 <= 0) {
                        bt.lr = new BiTangent(i, j);
                    }
                }
            }
            return bt;
        }
        geom.tangents = tangents;

        function isPointInsidePoly(p, poly) {
            for (var i = 1, n = poly.length; i < n; ++i)
                if (below(poly[i - 1], poly[i], p))
                    return false;
            return true;
        }

        function isAnyPInQ(p, q) {
            return !p.every(function (v) {
                return !isPointInsidePoly(v, q);
            });
        }

        function polysOverlap(p, q) {
            if (isAnyPInQ(p, q))
                return true;
            if (isAnyPInQ(q, p))
                return true;
            for (var i = 1, n = p.length; i < n; ++i) {
                var v = p[i], u = p[i - 1];
                if (intersects(new LineSegment(u.x, u.y, v.x, v.y), q).length > 0)
                    return true;
            }
            return false;
        }
        geom.polysOverlap = polysOverlap;
    })(cola.geom || (cola.geom = {}));
    var geom = cola.geom;
})(cola || (cola = {}));
var cola;
(function (cola) {
    function unionCount(a, b) {
        var u = {};
        for (var i in a)
            u[i] = {};
        for (var i in b)
            u[i] = {};
        return Object.keys(u).length;
    }

    function intersectionCount(a, b) {
        var n = 0;
        for (var i in a)
            if (typeof b[i] !== 'undefined')
                ++n;
        return n;
    }

    function getNeighbours(n, links, la) {
        var neighbours = new Array(n);
        for (var i = 0; i < n; ++i) {
            neighbours[i] = {};
        }
        links.forEach(function (e) {
            var u = la.getSourceIndex(e), v = la.getTargetIndex(e);
            neighbours[u][v] = {};
            neighbours[v][u] = {};
        });
        return neighbours;
    }

    function computeLinkLengths(n, links, w, f, la) {
        var neighbours = getNeighbours(n, links, la);
        links.forEach(function (l) {
            var a = neighbours[la.getSourceIndex(l)];
            var b = neighbours[la.getTargetIndex(l)];
            la.setLength(l, 1 + w * f(a, b));
        });
    }

    function symmetricDiffLinkLengths(n, links, la, w) {
        if (typeof w === "undefined") { w = 1; }
        computeLinkLengths(n, links, w, function (a, b) {
            return Math.sqrt(unionCount(a, b) - intersectionCount(a, b));
        }, la);
    }
    cola.symmetricDiffLinkLengths = symmetricDiffLinkLengths;

    function jaccardLinkLengths(n, links, la, w) {
        if (typeof w === "undefined") { w = 1; }
        computeLinkLengths(n, links, w, function (a, b) {
            return Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1 ? 0 : intersectionCount(a, b) / unionCount(a, b);
        }, la);
    }
    cola.jaccardLinkLengths = jaccardLinkLengths;

    function generateDirectedEdgeConstraints(n, links, axis, la) {
        var components = stronglyConnectedComponents(n, links, la);
        var nodes = {};
        components.filter(function (c) {
            return c.length > 1;
        }).forEach(function (c) {
            return c.forEach(function (v) {
                return nodes[v] = c;
            });
        });
        var constraints = [];
        links.forEach(function (l) {
            var ui = la.getSourceIndex(l), vi = la.getTargetIndex(l), u = nodes[ui], v = nodes[vi];
            if (!u || !v || u.component !== v.component) {
                constraints.push({
                    axis: axis,
                    left: ui,
                    right: vi,
                    gap: la.getMinSeparation(l)
                });
            }
        });
        return constraints;
    }
    cola.generateDirectedEdgeConstraints = generateDirectedEdgeConstraints;

    function stronglyConnectedComponents(numVertices, edges, la) {
        var adjList = new Array(numVertices);
        var index = new Array(numVertices);
        var lowValue = new Array(numVertices);
        var active = new Array(numVertices);

        for (var i = 0; i < numVertices; ++i) {
            adjList[i] = [];
            index[i] = -1;
            lowValue[i] = 0;
            active[i] = false;
        }

        for (var i = 0; i < edges.length; ++i) {
            adjList[la.getSourceIndex(edges[i])].push(la.getTargetIndex(edges[i]));
        }

        var count = 0;
        var S = [];
        var components = [];

        function strongConnect(v) {
            index[v] = count;
            lowValue[v] = count;
            active[v] = true;
            count += 1;
            S.push(v);
            var e = adjList[v];
            for (var i = 0; i < e.length; ++i) {
                var u = e[i];
                if (index[u] < 0) {
                    strongConnect(u);
                    lowValue[v] = Math.min(lowValue[v], lowValue[u]) | 0;
                } else if (active[u]) {
                    lowValue[v] = Math.min(lowValue[v], lowValue[u]);
                }
            }
            if (lowValue[v] === index[v]) {
                var component = [];
                for (var i = S.length - 1; i >= 0; --i) {
                    var w = S[i];
                    active[w] = false;
                    component.push(w);
                    if (w === v) {
                        S.length = i;
                        break;
                    }
                }
                components.push(component);
            }
        }

        for (var i = 0; i < numVertices; ++i) {
            if (index[i] < 0) {
                strongConnect(i);
            }
        }

        return components;
    }
})(cola || (cola = {}));
var cola;
(function (cola) {
    (function (powergraph) {
        var PowerEdge = (function () {
            function PowerEdge(source, target) {
                this.source = source;
                this.target = target;
            }
            return PowerEdge;
        })();
        powergraph.PowerEdge = PowerEdge;

        var Configuration = (function () {
            function Configuration(n, edges, linkAccessor) {
                var _this = this;
                this.linkAccessor = linkAccessor;
                this.modules = new Array(n);
                this.roots = new Array(n);
                for (var i = 0; i < n; ++i) {
                    this.roots[i] = this.modules[i] = new Module(i, {}, {}, {});
                }
                this.R = edges.length;
                edges.forEach(function (e) {
                    var s = _this.modules[linkAccessor.getSourceIndex(e)], t = _this.modules[linkAccessor.getTargetIndex(e)];
                    s.outgoing[t.id] = t;
                    t.incoming[s.id] = s;
                });
            }
            Configuration.prototype.merge = function (a, b) {
                var inInt = intersection(a.incoming, b.incoming), outInt = intersection(a.outgoing, b.outgoing);
                var children = {};
                children[a.id] = a;
                children[b.id] = b;
                var m = new Module(this.modules.length, outInt, inInt, children);
                this.modules.push(m);
                var update = function (s, i, o) {
                    for (var v in s) {
                        var n = s[v];
                        n[i][m.id] = m;
                        delete n[i][a.id];
                        delete n[i][b.id];
                        delete a[o][v];
                        delete b[o][v];
                    }
                };
                update(outInt, "incoming", "outgoing");
                update(inInt, "outgoing", "incoming");
                this.R -= Object.keys(inInt).length + Object.keys(outInt).length;
                delete this.roots[a.id];
                delete this.roots[b.id];
                this.roots[m.id] = m;
                return m;
            };

            Configuration.prototype.rootMerges = function () {
                var rs = Object.keys(this.roots);
                var n = rs.length;
                var merges = new Array(n * (n - 1));
                var ctr = 0;
                for (var i = 0, i_ = n - 1; i < i_; ++i) {
                    for (var j = i + 1; j < n; ++j) {
                        var a = this.roots[rs[i]], b = this.roots[rs[j]];
                        merges[ctr++] = { nEdges: this.nEdges(a, b), a: a, b: b };
                    }
                }
                return merges;
            };

            Configuration.prototype.greedyMerge = function () {
                var ms = this.rootMerges().sort(function (a, b) {
                    return a.nEdges - b.nEdges;
                });
                var m = ms[0];
                if (m.nEdges >= this.R)
                    return false;
                this.merge(m.a, m.b);
                return true;
            };

            Configuration.prototype.nEdges = function (a, b) {
                return this.R - intersectionCount(a.outgoing, b.outgoing) - intersectionCount(a.incoming, b.incoming);
            };

            Configuration.prototype.getGroupHierarchy = function (retargetedEdges) {
                var _this = this;
                var groups = [];
                var root = {};
                toGroups(this.roots, root, groups);
                var es = this.allEdges();
                es.forEach(function (e) {
                    var a = _this.modules[e.source];
                    var b = _this.modules[e.target];
                    retargetedEdges.push(new PowerEdge(typeof a.gid === "undefined" ? e.source : groups[a.gid], typeof b.gid === "undefined" ? e.target : groups[b.gid]));
                });
                return groups;
            };

            Configuration.prototype.allEdges = function () {
                var es = [];
                Configuration.getEdges(this.roots, es);
                return es;
            };

            Configuration.getEdges = function (modules, es) {
                for (var i in modules) {
                    var m = modules[i];
                    m.getEdges(es);
                    Configuration.getEdges(m.children, es);
                }
            };
            return Configuration;
        })();
        powergraph.Configuration = Configuration;

        function toGroups(modules, group, groups) {
            for (var i in modules) {
                var m = modules[i];
                if (m.isLeaf()) {
                    if (!group.leaves)
                        group.leaves = [];
                    group.leaves.push(m.id);
                } else {
                    var g = group;
                    m.gid = groups.length;
                    if (!m.isIsland()) {
                        g = { id: m.gid };
                        if (!group.groups)
                            group.groups = [];
                        group.groups.push(m.gid);
                        groups.push(g);
                    }
                    toGroups(m.children, g, groups);
                }
            }
        }

        var Module = (function () {
            function Module(id, outgoing, incoming, children) {
                this.id = id;
                this.outgoing = outgoing;
                this.incoming = incoming;
                this.children = children;
            }
            Module.prototype.getEdges = function (es) {
                for (var o in this.outgoing) {
                    es.push({ source: this.id, target: this.outgoing[o].id });
                }
            };
            Module.prototype.isLeaf = function () {
                return Object.keys(this.children).length == 0;
            };

            Module.prototype.isIsland = function () {
                return Object.keys(this.outgoing).length == 0 && Object.keys(this.incoming).length == 0;
            };
            return Module;
        })();
        powergraph.Module = Module;

        function intersection(m, n) {
            var i = {};
            for (var v in m)
                if (v in n)
                    i[v] = m[v];
            return i;
        }

        function intersectionCount(m, n) {
            return Object.keys(intersection(m, n)).length;
        }

        function getGroups(nodes, links, la) {
            var n = nodes.length, c = new powergraph.Configuration(n, links, la);
            while (c.greedyMerge())
                ;
            var powerEdges = [];
            var g = c.getGroupHierarchy(powerEdges);
            powerEdges.forEach(function (e) {
                var f = function (end) {
                    var g = e[end];
                    if (typeof g == "number")
                        e[end] = nodes[g];
                };
                f("source");
                f("target");
            });
            return { groups: g, powerEdges: powerEdges };
        }
        powergraph.getGroups = getGroups;
    })(cola.powergraph || (cola.powergraph = {}));
    var powergraph = cola.powergraph;
})(cola || (cola = {}));
var PairingHeap = (function () {
    function PairingHeap(elem) {
        this.elem = elem;
        this.subheaps = [];
    }
    PairingHeap.prototype.toString = function (selector) {
        var str = "", needComma = false;
        for (var i = 0; i < this.subheaps.length; ++i) {
            var subheap = this.subheaps[i];
            if (!subheap.elem) {
                needComma = false;
                continue;
            }
            if (needComma) {
                str = str + ",";
            }
            str = str + subheap.toString(selector);
            needComma = true;
        }
        if (str !== "") {
            str = "(" + str + ")";
        }
        return (this.elem ? selector(this.elem) : "") + str;
    };

    PairingHeap.prototype.forEach = function (f) {
        if (!this.empty()) {
            f(this.elem, this);
            this.subheaps.forEach(function (s) {
                return s.forEach(f);
            });
        }
    };

    PairingHeap.prototype.count = function () {
        return this.empty() ? 0 : 1 + this.subheaps.reduce(function (n, h) {
            return n + h.count();
        }, 0);
    };

    PairingHeap.prototype.min = function () {
        return this.elem;
    };

    PairingHeap.prototype.empty = function () {
        return this.elem == null;
    };

    PairingHeap.prototype.contains = function (h) {
        if (this === h)
            return true;
        for (var i = 0; i < this.subheaps.length; i++) {
            if (this.subheaps[i].contains(h))
                return true;
        }
        return false;
    };

    PairingHeap.prototype.isHeap = function (lessThan) {
        var _this = this;
        return this.subheaps.every(function (h) {
            return lessThan(_this.elem, h.elem) && h.isHeap(lessThan);
        });
    };

    PairingHeap.prototype.insert = function (obj, lessThan) {
        return this.merge(new PairingHeap(obj), lessThan);
    };

    PairingHeap.prototype.merge = function (heap2, lessThan) {
        if (this.empty())
            return heap2;
        else if (heap2.empty())
            return this;
        else if (lessThan(this.elem, heap2.elem)) {
            this.subheaps.push(heap2);
            return this;
        } else {
            heap2.subheaps.push(this);
            return heap2;
        }
    };

    PairingHeap.prototype.removeMin = function (lessThan) {
        if (this.empty())
            return null;
        else
            return this.mergePairs(lessThan);
    };

    PairingHeap.prototype.mergePairs = function (lessThan) {
        if (this.subheaps.length == 0)
            return new PairingHeap(null);
        else if (this.subheaps.length == 1) {
            return this.subheaps[0];
        } else {
            var firstPair = this.subheaps.pop().merge(this.subheaps.pop(), lessThan);
            var remaining = this.mergePairs(lessThan);
            return firstPair.merge(remaining, lessThan);
        }
    };
    PairingHeap.prototype.decreaseKey = function (subheap, newValue, setHeapNode, lessThan) {
        var newHeap = subheap.removeMin(lessThan);

        subheap.elem = newHeap.elem;
        subheap.subheaps = newHeap.subheaps;
        if (setHeapNode !== null && newHeap.elem !== null) {
            setHeapNode(subheap.elem, subheap);
        }
        var pairingNode = new PairingHeap(newValue);
        if (setHeapNode !== null) {
            setHeapNode(newValue, pairingNode);
        }
        return this.merge(pairingNode, lessThan);
    };
    return PairingHeap;
})();

var PriorityQueue = (function () {
    function PriorityQueue(lessThan) {
        this.lessThan = lessThan;
    }
    PriorityQueue.prototype.top = function () {
        if (this.empty()) {
            return null;
        }
        return this.root.elem;
    };

    PriorityQueue.prototype.push = function () {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            args[_i] = arguments[_i + 0];
        }
        var pairingNode;
        for (var i = 0, arg; arg = args[i]; ++i) {
            pairingNode = new PairingHeap(arg);
            this.root = this.empty() ? pairingNode : this.root.merge(pairingNode, this.lessThan);
        }
        return pairingNode;
    };

    PriorityQueue.prototype.empty = function () {
        return !this.root || !this.root.elem;
    };

    PriorityQueue.prototype.isHeap = function () {
        return this.root.isHeap(this.lessThan);
    };

    PriorityQueue.prototype.forEach = function (f) {
        this.root.forEach(f);
    };

    PriorityQueue.prototype.pop = function () {
        if (this.empty()) {
            return null;
        }
        var obj = this.root.min();
        this.root = this.root.removeMin(this.lessThan);
        return obj;
    };

    PriorityQueue.prototype.reduceKey = function (heapNode, newKey, setHeapNode) {
        if (typeof setHeapNode === "undefined") { setHeapNode = null; }
        this.root = this.root.decreaseKey(heapNode, newKey, setHeapNode, this.lessThan);
    };
    PriorityQueue.prototype.toString = function (selector) {
        return this.root.toString(selector);
    };

    PriorityQueue.prototype.count = function () {
        return this.root.count();
    };
    return PriorityQueue;
})();
var cola;
(function (cola) {
    (function (vpsc) {
        var PositionStats = (function () {
            function PositionStats(scale) {
                this.scale = scale;
                this.AB = 0;
                this.AD = 0;
                this.A2 = 0;
            }
            PositionStats.prototype.addVariable = function (v) {
                var ai = this.scale / v.scale;
                var bi = v.offset / v.scale;
                var wi = v.weight;
                this.AB += wi * ai * bi;
                this.AD += wi * ai * v.desiredPosition;
                this.A2 += wi * ai * ai;
            };

            PositionStats.prototype.getPosn = function () {
                return (this.AD - this.AB) / this.A2;
            };
            return PositionStats;
        })();
        vpsc.PositionStats = PositionStats;

        var Constraint = (function () {
            function Constraint(left, right, gap, equality) {
                if (typeof equality === "undefined") { equality = false; }
                this.left = left;
                this.right = right;
                this.gap = gap;
                this.equality = equality;
                this.active = false;
                this.unsatisfiable = false;
                this.left = left;
                this.right = right;
                this.gap = gap;
                this.equality = equality;
            }
            Constraint.prototype.slack = function () {
                return this.unsatisfiable ? Number.MAX_VALUE : this.right.scale * this.right.position() - this.gap - this.left.scale * this.left.position();
            };
            return Constraint;
        })();
        vpsc.Constraint = Constraint;

        var Variable = (function () {
            function Variable(desiredPosition, weight, scale) {
                if (typeof weight === "undefined") { weight = 1; }
                if (typeof scale === "undefined") { scale = 1; }
                this.desiredPosition = desiredPosition;
                this.weight = weight;
                this.scale = scale;
                this.offset = 0;
            }
            Variable.prototype.dfdv = function () {
                return 2.0 * this.weight * (this.position() - this.desiredPosition);
            };

            Variable.prototype.position = function () {
                return (this.block.ps.scale * this.block.posn + this.offset) / this.scale;
            };

            Variable.prototype.visitNeighbours = function (prev, f) {
                var ff = function (c, next) {
                    return c.active && prev !== next && f(c, next);
                };
                this.cOut.forEach(function (c) {
                    return ff(c, c.right);
                });
                this.cIn.forEach(function (c) {
                    return ff(c, c.left);
                });
            };
            return Variable;
        })();
        vpsc.Variable = Variable;

        var Block = (function () {
            function Block(v) {
                this.vars = [];
                v.offset = 0;
                this.ps = new PositionStats(v.scale);
                this.addVariable(v);
            }
            Block.prototype.addVariable = function (v) {
                v.block = this;
                this.vars.push(v);
                this.ps.addVariable(v);
                this.posn = this.ps.getPosn();
            };

            Block.prototype.updateWeightedPosition = function () {
                this.ps.AB = this.ps.AD = this.ps.A2 = 0;
                for (var i = 0, n = this.vars.length; i < n; ++i)
                    this.ps.addVariable(this.vars[i]);
                this.posn = this.ps.getPosn();
            };

            Block.prototype.compute_lm = function (v, u, postAction) {
                var _this = this;
                var dfdv = v.dfdv();
                v.visitNeighbours(u, function (c, next) {
                    var _dfdv = _this.compute_lm(next, v, postAction);
                    if (next === c.right) {
                        dfdv += _dfdv * c.left.scale;
                        c.lm = _dfdv;
                    } else {
                        dfdv += _dfdv * c.right.scale;
                        c.lm = -_dfdv;
                    }
                    postAction(c);
                });
                return dfdv / v.scale;
            };

            Block.prototype.populateSplitBlock = function (v, prev) {
                var _this = this;
                v.visitNeighbours(prev, function (c, next) {
                    next.offset = v.offset + (next === c.right ? c.gap : -c.gap);
                    _this.addVariable(next);
                    _this.populateSplitBlock(next, v);
                });
            };

            Block.prototype.traverse = function (visit, acc, v, prev) {
                var _this = this;
                if (typeof v === "undefined") { v = this.vars[0]; }
                if (typeof prev === "undefined") { prev = null; }
                v.visitNeighbours(prev, function (c, next) {
                    acc.push(visit(c));
                    _this.traverse(visit, acc, next, v);
                });
            };

            Block.prototype.findMinLM = function () {
                var m = null;
                this.compute_lm(this.vars[0], null, function (c) {
                    if (!c.equality && (m === null || c.lm < m.lm))
                        m = c;
                });
                return m;
            };

            Block.prototype.findMinLMBetween = function (lv, rv) {
                this.compute_lm(lv, null, function () {
                });
                var m = null;
                this.findPath(lv, null, rv, function (c, next) {
                    if (!c.equality && c.right === next && (m === null || c.lm < m.lm))
                        m = c;
                });
                return m;
            };

            Block.prototype.findPath = function (v, prev, to, visit) {
                var _this = this;
                var endFound = false;
                v.visitNeighbours(prev, function (c, next) {
                    if (!endFound && (next === to || _this.findPath(next, v, to, visit))) {
                        endFound = true;
                        visit(c, next);
                    }
                });
                return endFound;
            };

            Block.prototype.isActiveDirectedPathBetween = function (u, v) {
                if (u === v)
                    return true;
                var i = u.cOut.length;
                while (i--) {
                    var c = u.cOut[i];
                    if (c.active && this.isActiveDirectedPathBetween(c.right, v))
                        return true;
                }
                return false;
            };

            Block.split = function (c) {
                c.active = false;
                return [Block.createSplitBlock(c.left), Block.createSplitBlock(c.right)];
            };

            Block.createSplitBlock = function (startVar) {
                var b = new Block(startVar);
                b.populateSplitBlock(startVar, null);
                return b;
            };

            Block.prototype.splitBetween = function (vl, vr) {
                var c = this.findMinLMBetween(vl, vr);
                if (c !== null) {
                    var bs = Block.split(c);
                    return { constraint: c, lb: bs[0], rb: bs[1] };
                }

                return null;
            };

            Block.prototype.mergeAcross = function (b, c, dist) {
                c.active = true;
                for (var i = 0, n = b.vars.length; i < n; ++i) {
                    var v = b.vars[i];
                    v.offset += dist;
                    this.addVariable(v);
                }
                this.posn = this.ps.getPosn();
            };

            Block.prototype.cost = function () {
                var sum = 0, i = this.vars.length;
                while (i--) {
                    var v = this.vars[i], d = v.position() - v.desiredPosition;
                    sum += d * d * v.weight;
                }
                return sum;
            };
            return Block;
        })();
        vpsc.Block = Block;

        var Blocks = (function () {
            function Blocks(vs) {
                this.vs = vs;
                var n = vs.length;
                this.list = new Array(n);
                while (n--) {
                    var b = new Block(vs[n]);
                    this.list[n] = b;
                    b.blockInd = n;
                }
            }
            Blocks.prototype.cost = function () {
                var sum = 0, i = this.list.length;
                while (i--)
                    sum += this.list[i].cost();
                return sum;
            };

            Blocks.prototype.insert = function (b) {
                b.blockInd = this.list.length;
                this.list.push(b);
            };

            Blocks.prototype.remove = function (b) {
                var last = this.list.length - 1;
                var swapBlock = this.list[last];
                this.list.length = last;
                if (b !== swapBlock) {
                    this.list[b.blockInd] = swapBlock;
                    swapBlock.blockInd = b.blockInd;
                }
            };

            Blocks.prototype.merge = function (c) {
                var l = c.left.block, r = c.right.block;

                var dist = c.right.offset - c.left.offset - c.gap;
                if (l.vars.length < r.vars.length) {
                    r.mergeAcross(l, c, dist);
                    this.remove(l);
                } else {
                    l.mergeAcross(r, c, -dist);
                    this.remove(r);
                }
            };

            Blocks.prototype.forEach = function (f) {
                this.list.forEach(f);
            };

            Blocks.prototype.updateBlockPositions = function () {
                this.list.forEach(function (b) {
                    return b.updateWeightedPosition();
                });
            };

            Blocks.prototype.split = function (inactive) {
                var _this = this;
                this.updateBlockPositions();
                this.list.forEach(function (b) {
                    var v = b.findMinLM();
                    if (v !== null && v.lm < Solver.LAGRANGIAN_TOLERANCE) {
                        b = v.left.block;
                        Block.split(v).forEach(function (nb) {
                            return _this.insert(nb);
                        });
                        _this.remove(b);
                        inactive.push(v);
                    }
                });
            };
            return Blocks;
        })();
        vpsc.Blocks = Blocks;

        var Solver = (function () {
            function Solver(vs, cs) {
                this.vs = vs;
                this.cs = cs;
                this.vs = vs;
                vs.forEach(function (v) {
                    v.cIn = [], v.cOut = [];
                });
                this.cs = cs;
                cs.forEach(function (c) {
                    c.left.cOut.push(c);
                    c.right.cIn.push(c);
                });
                this.inactive = cs.map(function (c) {
                    c.active = false;
                    return c;
                });
                this.bs = null;
            }
            Solver.prototype.cost = function () {
                return this.bs.cost();
            };

            Solver.prototype.setStartingPositions = function (ps) {
                this.inactive = this.cs.map(function (c) {
                    c.active = false;
                    return c;
                });
                this.bs = new Blocks(this.vs);
                this.bs.forEach(function (b, i) {
                    return b.posn = ps[i];
                });
            };

            Solver.prototype.setDesiredPositions = function (ps) {
                this.vs.forEach(function (v, i) {
                    return v.desiredPosition = ps[i];
                });
            };

            Solver.prototype.mostViolated = function () {
                var minSlack = Number.MAX_VALUE, v = null, l = this.inactive, n = l.length, deletePoint = n;
                for (var i = 0; i < n; ++i) {
                    var c = l[i];
                    if (c.unsatisfiable)
                        continue;
                    var slack = c.slack();
                    if (c.equality || slack < minSlack) {
                        minSlack = slack;
                        v = c;
                        deletePoint = i;
                        if (c.equality)
                            break;
                    }
                }
                if (deletePoint !== n && (minSlack < Solver.ZERO_UPPERBOUND && !v.active || v.equality)) {
                    l[deletePoint] = l[n - 1];
                    l.length = n - 1;
                }
                return v;
            };

            Solver.prototype.satisfy = function () {
                if (this.bs == null) {
                    this.bs = new Blocks(this.vs);
                }

                this.bs.split(this.inactive);
                var v = null;
                while ((v = this.mostViolated()) && (v.equality || v.slack() < Solver.ZERO_UPPERBOUND && !v.active)) {
                    var lb = v.left.block, rb = v.right.block;

                    if (lb !== rb) {
                        this.bs.merge(v);
                    } else {
                        if (lb.isActiveDirectedPathBetween(v.right, v.left)) {
                            v.unsatisfiable = true;
                            continue;
                        }

                        var split = lb.splitBetween(v.left, v.right);
                        if (split !== null) {
                            this.bs.insert(split.lb);
                            this.bs.insert(split.rb);
                            this.bs.remove(lb);
                            this.inactive.push(split.constraint);
                        } else {
                            v.unsatisfiable = true;
                            continue;
                        }
                        if (v.slack() >= 0) {
                            this.inactive.push(v);
                        } else {
                            this.bs.merge(v);
                        }
                    }
                }
            };

            Solver.prototype.solve = function () {
                this.satisfy();
                var lastcost = Number.MAX_VALUE, cost = this.bs.cost();
                while (Math.abs(lastcost - cost) > 0.0001) {
                    this.satisfy();
                    lastcost = cost;
                    cost = this.bs.cost();
                }
                return cost;
            };
            Solver.LAGRANGIAN_TOLERANCE = -1e-4;
            Solver.ZERO_UPPERBOUND = -1e-10;
            return Solver;
        })();
        vpsc.Solver = Solver;
    })(cola.vpsc || (cola.vpsc = {}));
    var vpsc = cola.vpsc;
})(cola || (cola = {}));
var cola;
(function (cola) {
    (function (vpsc) {
        function computeGroupBounds(g) {
            g.bounds = typeof g.leaves !== "undefined" ? g.leaves.reduce(function (r, c) {
                return c.bounds.union(r);
            }, Rectangle.empty()) : Rectangle.empty();
            if (typeof g.groups !== "undefined")
                g.bounds = g.groups.reduce(function (r, c) {
                    return computeGroupBounds(c).union(r);
                }, g.bounds);
            g.bounds = g.bounds.inflate(g.padding);
            return g.bounds;
        }
        vpsc.computeGroupBounds = computeGroupBounds;

        var Rectangle = (function () {
            function Rectangle(x, X, y, Y) {
                this.x = x;
                this.X = X;
                this.y = y;
                this.Y = Y;
            }
            Rectangle.empty = function () {
                return new Rectangle(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);
            };

            Rectangle.prototype.cx = function () {
                return (this.x + this.X) / 2;
            };

            Rectangle.prototype.cy = function () {
                return (this.y + this.Y) / 2;
            };

            Rectangle.prototype.overlapX = function (r) {
                var ux = this.cx(), vx = r.cx();
                if (ux <= vx && r.x < this.X)
                    return this.X - r.x;
                if (vx <= ux && this.x < r.X)
                    return r.X - this.x;
                return 0;
            };

            Rectangle.prototype.overlapY = function (r) {
                var uy = this.cy(), vy = r.cy();
                if (uy <= vy && r.y < this.Y)
                    return this.Y - r.y;
                if (vy <= uy && this.y < r.Y)
                    return r.Y - this.y;
                return 0;
            };

            Rectangle.prototype.setXCentre = function (cx) {
                var dx = cx - this.cx();
                this.x += dx;
                this.X += dx;
            };

            Rectangle.prototype.setYCentre = function (cy) {
                var dy = cy - this.cy();
                this.y += dy;
                this.Y += dy;
            };

            Rectangle.prototype.width = function () {
                return this.X - this.x;
            };

            Rectangle.prototype.height = function () {
                return this.Y - this.y;
            };

            Rectangle.prototype.union = function (r) {
                return new Rectangle(Math.min(this.x, r.x), Math.max(this.X, r.X), Math.min(this.y, r.y), Math.max(this.Y, r.Y));
            };

            Rectangle.prototype.lineIntersections = function (x1, y1, x2, y2) {
                var sides = [
                    [this.x, this.y, this.X, this.y],
                    [this.X, this.y, this.X, this.Y],
                    [this.X, this.Y, this.x, this.Y],
                    [this.x, this.Y, this.x, this.y]];
                var intersections = [];
                for (var i = 0; i < 4; ++i) {
                    var r = Rectangle.lineIntersection(x1, y1, x2, y2, sides[i][0], sides[i][1], sides[i][2], sides[i][3]);
                    if (r !== null)
                        intersections.push({ x: r.x, y: r.y });
                }
                return intersections;
            };

            Rectangle.prototype.rayIntersection = function (x2, y2) {
                var ints = this.lineIntersections(this.cx(), this.cy(), x2, y2);
                return ints.length > 0 ? ints[0] : null;
            };

            Rectangle.prototype.vertices = function () {
                return [
                    { x: this.x, y: this.y },
                    { x: this.X, y: this.y },
                    { x: this.X, y: this.Y },
                    { x: this.x, y: this.Y },
                    { x: this.x, y: this.y }];
            };

            Rectangle.lineIntersection = function (x1, y1, x2, y2, x3, y3, x4, y4) {
                var dx12 = x2 - x1, dx34 = x4 - x3, dy12 = y2 - y1, dy34 = y4 - y3, denominator = dy34 * dx12 - dx34 * dy12;
                if (denominator == 0)
                    return null;
                var dx31 = x1 - x3, dy31 = y1 - y3, numa = dx34 * dy31 - dy34 * dx31, a = numa / denominator, numb = dx12 * dy31 - dy12 * dx31, b = numb / denominator;
                if (a >= 0 && a <= 1 && b >= 0 && b <= 1) {
                    return {
                        x: x1 + a * dx12,
                        y: y1 + a * dy12
                    };
                }
                return null;
            };

            Rectangle.prototype.inflate = function (pad) {
                return new Rectangle(this.x - pad, this.X + pad, this.y - pad, this.Y + pad);
            };
            return Rectangle;
        })();
        vpsc.Rectangle = Rectangle;

        function makeEdgeBetween(link, source, target, ah) {
            var si = source.rayIntersection(target.cx(), target.cy());
            if (!si)
                si = { x: source.cx(), y: source.cy() };
            var ti = target.rayIntersection(source.cx(), source.cy());
            if (!ti)
                ti = { x: target.cx(), y: target.cy() };
            var dx = ti.x - si.x, dy = ti.y - si.y, l = Math.sqrt(dx * dx + dy * dy), al = l - ah;
            link.sourceIntersection = si;
            link.targetIntersection = ti;
            link.arrowStart = { x: si.x + al * dx / l, y: si.y + al * dy / l };
        }
        vpsc.makeEdgeBetween = makeEdgeBetween;

        function makeEdgeTo(s, target, ah) {
            var ti = target.rayIntersection(s.x, s.y);
            if (!ti)
                ti = { x: target.cx(), y: target.cy() };
            var dx = ti.x - s.x, dy = ti.y - s.y, l = Math.sqrt(dx * dx + dy * dy);
            return { x: ti.x - ah * dx / l, y: ti.y - ah * dy / l };
        }
        vpsc.makeEdgeTo = makeEdgeTo;

        var Node = (function () {
            function Node(v, r, pos) {
                this.v = v;
                this.r = r;
                this.pos = pos;
                this.prev = makeRBTree();
                this.next = makeRBTree();
            }
            return Node;
        })();

        var Event = (function () {
            function Event(isOpen, v, pos) {
                this.isOpen = isOpen;
                this.v = v;
                this.pos = pos;
            }
            return Event;
        })();

        function compareEvents(a, b) {
            if (a.pos > b.pos) {
                return 1;
            }
            if (a.pos < b.pos) {
                return -1;
            }
            if (a.isOpen) {
                return -1;
            }
            return 0;
        }

        function makeRBTree() {
            return new RBTree(function (a, b) {
                return a.pos - b.pos;
            });
        }

        var xRect = {
            getCentre: function (r) {
                return r.cx();
            },
            getOpen: function (r) {
                return r.y;
            },
            getClose: function (r) {
                return r.Y;
            },
            getSize: function (r) {
                return r.width();
            },
            makeRect: function (open, close, center, size) {
                return new Rectangle(center - size / 2, center + size / 2, open, close);
            },
            findNeighbours: findXNeighbours
        };

        var yRect = {
            getCentre: function (r) {
                return r.cy();
            },
            getOpen: function (r) {
                return r.x;
            },
            getClose: function (r) {
                return r.X;
            },
            getSize: function (r) {
                return r.height();
            },
            makeRect: function (open, close, center, size) {
                return new Rectangle(open, close, center - size / 2, center + size / 2);
            },
            findNeighbours: findYNeighbours
        };

        function generateGroupConstraints(root, f, minSep, isContained) {
            if (typeof isContained === "undefined") { isContained = false; }
            var padding = root.padding, gn = typeof root.groups !== 'undefined' ? root.groups.length : 0, ln = typeof root.leaves !== 'undefined' ? root.leaves.length : 0, childConstraints = !gn ? [] : root.groups.reduce(function (ccs, g) {
                return ccs.concat(generateGroupConstraints(g, f, minSep, true));
            }, []), n = (isContained ? 2 : 0) + ln + gn, vs = new Array(n), rs = new Array(n), i = 0, add = function (r, v) {
                rs[i] = r;
                vs[i++] = v;
            };
            if (isContained) {
                var b = root.bounds, c = f.getCentre(b), s = f.getSize(b) / 2, open = f.getOpen(b), close = f.getClose(b), min = c - s + padding / 2, max = c + s - padding / 2;
                root.minVar.desiredPosition = min;
                add(f.makeRect(open, close, min, padding), root.minVar);
                root.maxVar.desiredPosition = max;
                add(f.makeRect(open, close, max, padding), root.maxVar);
            }
            if (ln)
                root.leaves.forEach(function (l) {
                    return add(l.bounds, l.variable);
                });
            if (gn)
                root.groups.forEach(function (g) {
                    var b = g.bounds;
                    add(f.makeRect(f.getOpen(b), f.getClose(b), f.getCentre(b), f.getSize(b)), g.minVar);
                });
            var cs = generateConstraints(rs, vs, f, minSep);
            if (gn) {
                vs.forEach(function (v) {
                    v.cOut = [], v.cIn = [];
                });
                cs.forEach(function (c) {
                    c.left.cOut.push(c), c.right.cIn.push(c);
                });
                root.groups.forEach(function (g) {
                    var gapAdjustment = (g.padding - f.getSize(g.bounds)) / 2;
                    g.minVar.cIn.forEach(function (c) {
                        return c.gap += gapAdjustment;
                    });
                    g.minVar.cOut.forEach(function (c) {
                        c.left = g.maxVar;
                        c.gap += gapAdjustment;
                    });
                });
            }
            return childConstraints.concat(cs);
        }

        function generateConstraints(rs, vars, rect, minSep) {
            var i, n = rs.length;
            var N = 2 * n;
            console.assert(vars.length >= n);
            var events = new Array(N);
            for (i = 0; i < n; ++i) {
                var r = rs[i];
                var v = new Node(vars[i], r, rect.getCentre(r));
                events[i] = new Event(true, v, rect.getOpen(r));
                events[i + n] = new Event(false, v, rect.getClose(r));
            }
            events.sort(compareEvents);
            var cs = new Array();
            var scanline = makeRBTree();
            for (i = 0; i < N; ++i) {
                var e = events[i];
                var v = e.v;
                if (e.isOpen) {
                    scanline.insert(v);
                    rect.findNeighbours(v, scanline);
                } else {
                    scanline.remove(v);
                    var makeConstraint = function (l, r) {
                        var sep = (rect.getSize(l.r) + rect.getSize(r.r)) / 2 + minSep;
                        cs.push(new cola.vpsc.Constraint(l.v, r.v, sep));
                    };
                    var visitNeighbours = function (forward, reverse, mkcon) {
                        var u, it = v[forward].iterator();
                        while ((u = it[forward]()) !== null) {
                            mkcon(u, v);
                            u[reverse].remove(v);
                        }
                    };
                    visitNeighbours("prev", "next", function (u, v) {
                        return makeConstraint(u, v);
                    });
                    visitNeighbours("next", "prev", function (u, v) {
                        return makeConstraint(v, u);
                    });
                }
            }
            console.assert(scanline.size === 0);
            return cs;
        }

        function findXNeighbours(v, scanline) {
            var f = function (forward, reverse) {
                var it = scanline.findIter(v);
                var u;
                while ((u = it[forward]()) !== null) {
                    var uovervX = u.r.overlapX(v.r);
                    if (uovervX <= 0 || uovervX <= u.r.overlapY(v.r)) {
                        v[forward].insert(u);
                        u[reverse].insert(v);
                    }
                    if (uovervX <= 0) {
                        break;
                    }
                }
            };
            f("next", "prev");
            f("prev", "next");
        }

        function findYNeighbours(v, scanline) {
            var f = function (forward, reverse) {
                var u = scanline.findIter(v)[forward]();
                if (u !== null && u.r.overlapX(v.r) > 0) {
                    v[forward].insert(u);
                    u[reverse].insert(v);
                }
            };
            f("next", "prev");
            f("prev", "next");
        }

        function generateXConstraints(rs, vars) {
            return generateConstraints(rs, vars, xRect, 1e-6);
        }
        vpsc.generateXConstraints = generateXConstraints;

        function generateYConstraints(rs, vars) {
            return generateConstraints(rs, vars, yRect, 1e-6);
        }
        vpsc.generateYConstraints = generateYConstraints;

        function generateXGroupConstraints(root) {
            return generateGroupConstraints(root, xRect, 1e-6);
        }
        vpsc.generateXGroupConstraints = generateXGroupConstraints;

        function generateYGroupConstraints(root) {
            return generateGroupConstraints(root, yRect, 1e-6);
        }
        vpsc.generateYGroupConstraints = generateYGroupConstraints;

        function removeOverlaps(rs) {
            var vs = rs.map(function (r) {
                return new cola.vpsc.Variable(r.cx());
            });
            var cs = cola.vpsc.generateXConstraints(rs, vs);
            var solver = new cola.vpsc.Solver(vs, cs);
            solver.solve();
            vs.forEach(function (v, i) {
                return rs[i].setXCentre(v.position());
            });
            vs = rs.map(function (r) {
                return new cola.vpsc.Variable(r.cy());
            });
            cs = cola.vpsc.generateYConstraints(rs, vs);
            solver = new cola.vpsc.Solver(vs, cs);
            solver.solve();
            vs.forEach(function (v, i) {
                return rs[i].setYCentre(v.position());
            });
        }
        vpsc.removeOverlaps = removeOverlaps;

        var IndexedVariable = (function (_super) {
            __extends(IndexedVariable, _super);
            function IndexedVariable(index, w) {
                _super.call(this, 0, w);
                this.index = index;
            }
            return IndexedVariable;
        })(cola.vpsc.Variable);

        var Projection = (function () {
            function Projection(nodes, groups, rootGroup, constraints, avoidOverlaps) {
                if (typeof rootGroup === "undefined") { rootGroup = null; }
                if (typeof constraints === "undefined") { constraints = null; }
                if (typeof avoidOverlaps === "undefined") { avoidOverlaps = false; }
                var _this = this;
                this.nodes = nodes;
                this.groups = groups;
                this.rootGroup = rootGroup;
                this.avoidOverlaps = avoidOverlaps;
                this.variables = nodes.map(function (v, i) {
                    return v.variable = new IndexedVariable(i, 1);
                });

                if (constraints)
                    this.createConstraints(constraints);

                if (avoidOverlaps && rootGroup && typeof rootGroup.groups !== 'undefined') {
                    nodes.forEach(function (v) {
                        if (!v.width || !v.height) {
                            v.bounds = new cola.vpsc.Rectangle(v.x, v.x, v.y, v.y);
                            return;
                        }
                        var w2 = v.width / 2, h2 = v.height / 2;
                        v.bounds = new cola.vpsc.Rectangle(v.x - w2, v.x + w2, v.y - h2, v.y + h2);
                    });
                    computeGroupBounds(rootGroup);
                    var i = nodes.length;
                    groups.forEach(function (g) {
                        _this.variables[i] = g.minVar = new IndexedVariable(i++, 0.01);
                        _this.variables[i] = g.maxVar = new IndexedVariable(i++, 0.01);
                    });
                }
            }
            Projection.prototype.createSeparation = function (c) {
                return new cola.vpsc.Constraint(this.nodes[c.left].variable, this.nodes[c.right].variable, c.gap, typeof c.equality !== "undefined" ? c.equality : false);
            };

            Projection.prototype.makeFeasible = function (c) {
                var _this = this;
                if (!this.avoidOverlaps)
                    return;
                var axis = 'x', dim = 'width';
                if (c.axis === 'x')
                    axis = 'y', dim = 'height';
                var vs = c.offsets.map(function (o) {
                    return _this.nodes[o.node];
                }).sort(function (a, b) {
                    return a[axis] - b[axis];
                });
                var p = null;
                vs.forEach(function (v) {
                    if (p)
                        v[axis] = p[axis] + p[dim] + 1;
                    p = v;
                });
            };

            Projection.prototype.createAlignment = function (c) {
                var _this = this;
                var u = this.nodes[c.offsets[0].node].variable;
                this.makeFeasible(c);
                var cs = c.axis === 'x' ? this.xConstraints : this.yConstraints;
                c.offsets.slice(1).forEach(function (o) {
                    var v = _this.nodes[o.node].variable;
                    cs.push(new cola.vpsc.Constraint(u, v, o.offset, true));
                });
            };

            Projection.prototype.createConstraints = function (constraints) {
                var _this = this;
                var isSep = function (c) {
                    return typeof c.type === 'undefined' || c.type === 'separation';
                };
                this.xConstraints = constraints.filter(function (c) {
                    return c.axis === "x" && isSep(c);
                }).map(function (c) {
                    return _this.createSeparation(c);
                });
                this.yConstraints = constraints.filter(function (c) {
                    return c.axis === "y" && isSep(c);
                }).map(function (c) {
                    return _this.createSeparation(c);
                });
                constraints.filter(function (c) {
                    return c.type === 'alignment';
                }).forEach(function (c) {
                    return _this.createAlignment(c);
                });
            };

            Projection.prototype.setupVariablesAndBounds = function (x0, y0, desired, getDesired) {
                this.nodes.forEach(function (v, i) {
                    if (v.fixed) {
                        v.variable.weight = 1000;
                        desired[i] = getDesired(v);
                    } else {
                        v.variable.weight = 1;
                    }
                    var w = (v.width || 0) / 2, h = (v.height || 0) / 2;
                    var ix = x0[i], iy = y0[i];
                    v.bounds = new Rectangle(ix - w, ix + w, iy - h, iy + h);
                });
            };

            Projection.prototype.xProject = function (x0, y0, x) {
                if (!this.rootGroup && !(this.avoidOverlaps || this.xConstraints))
                    return;
                this.project(x0, y0, x0, x, function (v) {
                    return v.px;
                }, this.xConstraints, generateXGroupConstraints, function (v) {
                    return v.bounds.setXCentre(x[v.variable.index] = v.variable.position());
                }, function (g) {
                    var xmin = x[g.minVar.index] = g.minVar.position();
                    var xmax = x[g.maxVar.index] = g.maxVar.position();
                    var p2 = g.padding / 2;
                    g.bounds.x = xmin - p2;
                    g.bounds.X = xmax + p2;
                });
            };

            Projection.prototype.yProject = function (x0, y0, y) {
                if (!this.rootGroup && !this.yConstraints)
                    return;
                this.project(x0, y0, y0, y, function (v) {
                    return v.py;
                }, this.yConstraints, generateYGroupConstraints, function (v) {
                    return v.bounds.setYCentre(y[v.variable.index] = v.variable.position());
                }, function (g) {
                    var ymin = y[g.minVar.index] = g.minVar.position();
                    var ymax = y[g.maxVar.index] = g.maxVar.position();
                    var p2 = g.padding / 2;
                    g.bounds.y = ymin - p2;
                    ;
                    g.bounds.Y = ymax + p2;
                });
            };

            Projection.prototype.projectFunctions = function () {
                var _this = this;
                return [
                    function (x0, y0, x) {
                        return _this.xProject(x0, y0, x);
                    },
                    function (x0, y0, y) {
                        return _this.yProject(x0, y0, y);
                    }
                ];
            };

            Projection.prototype.project = function (x0, y0, start, desired, getDesired, cs, generateConstraints, updateNodeBounds, updateGroupBounds) {
                this.setupVariablesAndBounds(x0, y0, desired, getDesired);
                if (this.rootGroup && this.avoidOverlaps) {
                    computeGroupBounds(this.rootGroup);
                    cs = cs.concat(generateConstraints(this.rootGroup));
                }
                this.solve(this.variables, cs, start, desired);
                this.nodes.forEach(updateNodeBounds);
                if (this.rootGroup && this.avoidOverlaps) {
                    this.groups.forEach(updateGroupBounds);
                }
            };

            Projection.prototype.solve = function (vs, cs, starting, desired) {
                var solver = new cola.vpsc.Solver(vs, cs);
                solver.setStartingPositions(starting);
                solver.setDesiredPositions(desired);
                solver.solve();
            };
            return Projection;
        })();
        vpsc.Projection = Projection;
    })(cola.vpsc || (cola.vpsc = {}));
    var vpsc = cola.vpsc;
})(cola || (cola = {}));
var cola;
(function (cola) {
    (function (shortestpaths) {
        var Neighbour = (function () {
            function Neighbour(id, distance) {
                this.id = id;
                this.distance = distance;
            }
            return Neighbour;
        })();

        var Node = (function () {
            function Node(id) {
                this.id = id;
                this.neighbours = [];
            }
            return Node;
        })();

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
            Calculator.prototype.DistanceMatrix = function () {
                var D = new Array(this.n);
                for (var i = 0; i < this.n; ++i) {
                    D[i] = this.dijkstraNeighbours(i);
                }
                return D;
            };

            Calculator.prototype.DistancesFromNode = function (start) {
                return this.dijkstraNeighbours(start);
            };

            Calculator.prototype.PathFromNodeToNode = function (start, end) {
                return this.dijkstraNeighbours(start, end);
            };

            Calculator.prototype.dijkstraNeighbours = function (start, dest) {
                if (typeof dest === "undefined") { dest = -1; }
                var q = new PriorityQueue(function (a, b) {
                    return a.d <= b.d;
                }), i = this.neighbours.length, d = new Array(i);
                while (i--) {
                    var node = this.neighbours[i];
                    node.d = i === start ? 0 : Number.POSITIVE_INFINITY;
                    node.q = q.push(node);
                }
                while (!q.empty()) {
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
                            q.reduceKey(v.q, v, function (e, q) {
                                return e.q = q;
                            });
                        }
                    }
                }
                return d;
            };
            return Calculator;
        })();
        shortestpaths.Calculator = Calculator;
    })(cola.shortestpaths || (cola.shortestpaths = {}));
    var shortestpaths = cola.shortestpaths;
})(cola || (cola = {}));
