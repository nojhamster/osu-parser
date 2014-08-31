'use strict';

var curves  = require('./curves');
var Bezier  = curves.Bezier;

/**
 * Get the endpoint of a slider
 * @param  {String} sliderType    slider curve type
 * @param  {Float}  sliderLength  slider length
 * @param  {Array}  points        list of slider points
 * @return {Object} endPoint      the coordinates of the slider edge
 */
exports.getEndPoint = function (sliderType, sliderLength, points) {
  if (!sliderType || !sliderLength || !points) return;

  switch (sliderType) {
    case 'linear':
      return pointOnLine(points[0], points[1], sliderLength);
    case 'catmull':
      // not supported, anyway it's only used in old beatmaps
      return undefined;
    case 'bezier':
      if (!points || points.length < 2) { return undefined; }
      if (points.length == 2) { return pointOnLine(points[0], points[1], sliderLength); }

      var pts = points.slice();
      var bezier;
      var previous;
      var point;
      for (var i = 0, l = pts.length; i < l; i++) {
        point = pts[i];

        if (!previous) {
          previous = point;
          continue;
        }

        if (point[0] == previous[0] && point[1] == previous[1]) {
          bezier        = new Bezier(pts.splice(0, i));
          sliderLength -= bezier.pxlength;
          i = 0;
          l = pts.length;
        }

        previous = point;
      }

      bezier = new Bezier(pts);
      return bezier.pointAtDistance(sliderLength);
    case 'pass-through':
      if (!points || points.length < 2) { return undefined; }
      if (points.length == 2) { return pointOnLine(points[0], points[1], sliderLength); }
      if (points.length > 3)  { return exports.getEndPoint('bezier', sliderLength, points); }

      var p1 = points[0];
      var p2 = points[1];
      var p3 = points[2];

      var circumCicle = getCircumCircle(p1, p2, p3);
      var radians     = sliderLength / circumCicle.radius;
      if (isLeft(p1, p2, p3)) radians *= -1;

      return rotate(circumCicle.cx, circumCicle.cy, p1[0], p1[1], radians);
  }
};

function pointOnLine(p1, p2, length) {
  var fullLength = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
  var n = fullLength - length;

  var x = (n * p1[0] + length * p2[0]) / fullLength;
  var y = (n * p1[1] + length * p2[1]) / fullLength;
  return [x, y];
}

/**
 * Get coordinates of a point in a circle, given the center, a startpoint and a distance in radians
 * @param {Float} cx       center x
 * @param {Float} cy       center y
 * @param {Float} x        startpoint x
 * @param {Float} y        startpoint y
 * @param {Float} radians  distance from the startpoint
 * @return {Object} the new point coordinates after rotation
 */
function rotate(cx, cy, x, y, radians) {
  var cos = Math.cos(radians);
  var sin = Math.sin(radians);

  return [
    (cos * (x - cx)) - (sin * (y - cy)) + cx,
    (sin * (x - cx)) + (cos * (y - cy)) + cy
  ];
}

/**
 * Check if C is on left side of [AB]
 * @param {Object} a startpoint of the segment
 * @param {Object} b endpoint of the segment
 * @param {Object} c the point we want to locate
 * @return {Boolean} true if on left side
 */
function isLeft(a, b, c) {
  return ((b[0] - a[0])*(c[1] - a[1]) - (b[1] - a[1])*(c[0] - a[0])) < 0;
}

/**
 * Get circum circle of 3 points
 * @param  {Object} p1 first point
 * @param  {Object} p2 second point
 * @param  {Object} p3 third point
 * @return {Object} circumCircle
 */
function getCircumCircle(p1, p2, p3) {
  var x1 = p1[0];
  var y1 = p1[1];

  var x2 = p2[0];
  var y2 = p2[1];

  var x3 = p3[0];
  var y3 = p3[1];

  //center of circle
  var D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

  var Ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
  var Uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;

  var px = Ux - x1;
  var py = Uy - y1;
  var r = Math.sqrt(px * px + py * py);

  return {
    cx: Ux,
    cy: Uy,
    radius: r
  };
}