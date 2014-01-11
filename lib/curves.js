'use strict';

/**
 * Taken from Osu-Web with some fixes
 * https://github.com/pictuga/osu-web
 */

function isPointInCircle(point, center, radius) {
  return distancePoints(point, center) <= radius;
}

function distancePoints(p1, p2) {
  var x = (p1[0]-p2[0]);
  var y = (p1[1]-p2[1]);
  return Math.sqrt(x*x+ y*y);
}

function distanceFromPoints(array) {
  var distance = 0;

  for (var i = 1; i <= array.length - 1; i++)
    distance += distancePoints(array[i], array[i-1]);

  return distance;
}

function angleFromPoints(p1, p2) {
  return Math.atan((p2[1]-p1[1])/(p2[0]-p1[0]));
}

function cartFromPol(r, teta) {
  var x2 = (r*Math.cos(teta));
  var y2 = (r*Math.sin(teta));

  return [x2, y2];
}

function pointAtDistance(array, distance) {
  //needs a serious cleanup !

  var current_distance = 0;
  var last_distance    = 0;
  var coord, angle, cart, new_distance;

  if (array.length < 2) return [0, 0, 0, 0];

  if (distance == 0) {
    var angle = angleFromPoints(array[0], array[1]);
    return [array[0][0], array[0][1], angle, 0];
  }

  if (distanceFromPoints(array) <= distance) {
    var angle = angleFromPoints(array[array.length-2], array[array.length-1]);
    return [
      array[array.length-1][0],
      array[array.length-1][1],
      angle,
      array.length-2
    ];
  }

  for (var i = 0; i <= array.length - 2; i++) {
    var x = (array[i][0]-array[i+1][0]);
    var y = (array[i][1]-array[i+1][1]);

    new_distance = (Math.sqrt(x*x+y*y));
    current_distance += new_distance;

    if (distance <= current_distance) break;
  }

  current_distance -= new_distance;

  if (distance == current_distance) {
    coord = [array[i][0], array[i][1]];
    angle = angleFromPoints(array[i], array[i+1]);
  } else {
    angle = angleFromPoints(array[i], array[i+1]);
    cart  = cartFromPol((distance - current_distance), angle);

    if (array[i][0] > array[i+1][0])
      coord = [(array[i][0] - cart[0]), (array[i][1] - cart[1])];
    else
      coord = [(array[i][0] + cart[0]), (array[i][1] + cart[1])];
  }

  return [coord[0], coord[1], angle, i];
}

function factorial(n) {
  n = parseInt(n) || 1;

  var result = 1;
  for (var i = 1; i <= n; i++) result *= i;

  return result;
}

function Cpn(p, n) {
  if (p < 0 || p > n)
    return 0;
  var p   = Math.min(p, n - p);
  var out = 1;
  for (var i = 1; i < p + 1; i++)
    out = out * (n - p + i) / i;
  return out;
}

function array_values(array) {
  var out = [];
  for (var i in array) out.push(array[i]);
  return out;
}

function array_calc(op, array1, array2) {
  var min = Math.min(array1.length, array2.length);
  var retour = [];

  for (var i = 0; i < min; i++)
    retour.push(array1[i] + op * array2[i]);

  return retour;
}

/*************************************************************/

function Bezier(points) {
  this.points = points;
  this.order  = points.length;

  this.step = 0.0025 / this.order; // x0.10
  this.pos  = {};
  this.calcPoints();
};

Bezier.prototype.at = function(t) {
  //B(t) = sum_(i=0)^n (i parmis n) (1-t)^(n-i) * t^i * P_i
  if (typeof this.pos[t] != "undefined") return this.pos[t];
  var x = 0,
    y = 0;
  var n = this.order - 1;

  for (var i = 0; i <= n; i++) {
    x += Cpn(i, n) * Math.pow((1 - t), (n - i)) * Math.pow(t, i) * this.points[i][0];
    y += Cpn(i, n) * Math.pow((1 - t), (n - i)) * Math.pow(t, i) * this.points[i][1];
  }

  this.pos[t] = [x, y];

  return [x, y];
};

// Changed to approximate length
Bezier.prototype.calcPoints = function() {
  if (Object.keys(this.pos).length) return;

  this.pxlength = 0;
  var prev = this.at(0);
  var current;
  for (var i = 0; i < 1 + this.step; i += this.step) {
    var current = this.at(i);
    this.pxlength += distancePoints(prev, current);
    prev = current;
  }
};


/*************************************************************/


Bezier.prototype.pointAtDistance = Catmull.prototype.pointAtDistance = function(dist) {
  switch (this.order) {
    case 0:
      return false;
    case 1:
      return this.points[0];
    default:
      this.calcPoints();
      return pointAtDistance(array_values(this.pos), dist).slice(0, 2);
  }
};

/*************************************************************/

function Catmull(points) {
  this.points = points;
  this.order  = points.length;

  this.step = 0.025;
  this.pos  = [];
  this.calcPoints();
};

Catmull.prototype.at = function(x, t) {
  var v1 = (x >= 1 ? this.points[x - 1] : this.points[x]);
  var v2 = this.points[x];
  var v3 = (x + 1 < this.order ? this.points[x + 1] : array_calc('1', v2, array_calc('-1', v2, v1)));
  var v4 = (x + 2 < this.order ? this.points[x + 2] : array_calc('1', v3, array_calc('-1', v3, v2)));

  var retour = [];
  for (var i = 0; i <= 1; i++) {
    retour[i] = 0.5 * (
      (-v1[i] + 3 * v2[i] - 3 * v3[i] + v4[i]) * t * t * t + (2 * v1[i] - 5 * v2[i] + 4 * v3[i] - v4[i]) * t * t + (-v1[i] + v3[i]) * t + 2 * v2[i]);
  }

  return retour;
};

Catmull.prototype.calcPoints = function() {
  if (this.pos.length) return;
  for (var i = 0; i < this.order - 1; i++)
    for (var t = 0; t < 1 + this.step; t += this.step)
      this.pos.push(this.at(i, t));
};

exports.Bezier  = Bezier;
exports.Catmull = Catmull;
