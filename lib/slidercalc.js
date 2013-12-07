'use strict';

/**
 * Get the endpoint of a slider
 * @param  {String} sliderType    slider curve type
 * @param  {Float}  sliderLength  slider length
 * @param  {Array}  pointsList    list of slider points
 * @return {Object} endPoint      the coordinates of the slider edge
 */
exports.getEndPoint = function (sliderType, sliderLength, pointsList) {
  if (!sliderType || !sliderLength || !pointsList) return;

  switch (sliderType) {
    case 'linear':
      var p1 = pointsList[0];
      var p2 = pointsList[1];

      var fullLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      var n = fullLength - sliderLength;

      var x = (n * p1.x + sliderLength * p2.x) / fullLength;
      var y = (n * p1.y + sliderLength * p2.y) / fullLength;
      return { x: x, y: y };
    case 'catmull':
      break;
    case 'bezier':
      break;
    case 'pass-through':
      var p1 = pointsList[0];
      var p2 = pointsList[1];
      var p3 = pointsList[2];

      var leftSided   = isLeft(p1, p2, p3);
      var circumCicle = computeCircumCircle(p1, p2, p3);
      var radians     = sliderLength / circumCicle.radius;
      var endPoint    = rotate(circumCicle.center_x, circumCicle.center_y, p1.x, p1.y, leftSided ? -radians : radians);

      return endPoint;
  }
};

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

  return {
    x: (cos * (x - cx)) - (sin * (y - cy)) + cx,
    y: (sin * (x - cx)) + (cos * (y - cy)) + cy
  };
}

/**
 * Check if C is on left side of AB
 * @param {Object} a startpoint of the segment
 * @param {Object} b endpoint of the segment
 * @param {Object} c the point we want to locate
 * @return {Boolean} true if on left side
 */
function isLeft(a, b, c) {
  return ((b.x - a.x)*(c.y - a.y) - (b.y - a.y)*(c.x - a.x)) < 0;
}

/**
 * Get circum circle of 3 points
 * @param  {Object} p1 first point
 * @param  {Object} p2 second point
 * @param  {Object} p3 third point
 * @return {Object} circumCircle
 */
function computeCircumCircle(p1, p2, p3) {
  var x1 = p1.x;
  var y1 = p1.y;

  var x2 = p2.x;
  var y2 = p2.y;

  var x3 = p3.x;
  var y3 = p3.y;

  //center of circle
  var D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

  var Ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
  var Uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;

  var px = Ux - x1;
  var py = Uy - y1;
  var r = Math.sqrt(px * px + py * py);

  return {
    center_x: Ux,
    center_y: Uy,
    radius: r
  };
}