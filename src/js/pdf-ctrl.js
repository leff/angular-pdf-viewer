angular.module('pdf')
  .service("pdfEventService", [
    '$rootScope',
  function($rootScope) {
      this.broadcast = function(eventType, event) {
        $rootScope.$broadcast('pdf:'+eventType, event);
      };
      this.listen = function(eventType, callback) {
        $rootScope.$on('pdf:'+eventType, callback);
      };
  }])
  .controller('PdfCtrl', [
    '$scope',
    '$element',
    '$attrs',
    'pdfDelegate',
    '$log',
    'pdfEventService',
    '$q',
  function($scope, $element, $attrs, pdfDelegate, $log, pdfEventService, $q) {

    // Register the instance!
    var deregisterInstance = pdfDelegate._registerInstance(this, $attrs.delegateHandle);
    // De-Register on destory!
    $scope.$on('$destroy', deregisterInstance);

    var self = this;

    var url = $scope.$eval($attrs.url);
    var headers = $scope.$eval($attrs.headers);
    var pdfDoc;
    $scope.pageCount = 0;
    var currentPage = 1;
    var angle = 0;
    var scale = $attrs.scale ? $attrs.scale : 1;
    var $canvas = $element.find('canvas');
    var canvas = $canvas[0];
    var ctx = canvas.getContext('2d');

    var renderPage = function(num) {
      var deferred = $q.defer();
      if (!angular.isNumber(num))
        num = parseInt(num);

      pdfEventService.broadcast('renderStart');

      pdfDoc
        .getPage(num)
        .then(function(page) {
          var viewport = page.getViewport(scale);
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          var renderContext = {
            canvasContext: ctx,
            viewport: viewport
          };

          var renderTask = page.render(renderContext);
          renderTask.promise.then(function () {
            pdfEventService.broadcast('renderComplete');
            deferred.resolve('renderComplete');
          });
        });
      return deferred.promise;
    };

    var transform = function() {
      canvas.style.webkitTransform = 'rotate('+ angle + 'deg)';
      canvas.style.MozTransform = 'rotate('+ angle + 'deg)';
      canvas.style.msTransform = 'rotate('+ angle + 'deg)';
      canvas.style.OTransform = 'rotate('+ angle + 'deg)';
      canvas.style.transform = 'rotate('+ angle + 'deg)';
    };

    var navigationOptions = function(options) {
      if( options ) {
        if( options.scale ) { scale = parseFloat(options.scale); }
      }
    };

    self.prev = function(options) {
      var deferred = $q.defer();
      if (currentPage <= 1) {
        deferred.reject('At first page');
      } else {
        navigationOptions(options);
        currentPage = parseInt(currentPage, 10) - 1;
        renderPage(currentPage).then(function() {
          deferred.resolve(currentPage);
        });
        pdfEventService.broadcast('pageChanged', currentPage);
      }
      return deferred.promise;
    };

    self.next = function(options) {
      var deferred = $q.defer();
      if (currentPage >= pdfDoc.numPages) {
        deferred.reject('No more pages');
      } else {
        navigationOptions(options);
        currentPage = parseInt(currentPage, 10) + 1;
        renderPage(currentPage).then(function() {
          deferred.resolve(currentPage);
        });
        pdfEventService.broadcast('pageChanged', currentPage);
      }
      return deferred.promise;
    };

    self.zoomIn = function(amount) {
      var deferred = $q.defer();
      amount = amount || 0.2;
      scale = parseFloat(scale) + amount;
      renderPage(currentPage).then(function() {
        deferred.resolve(scale);
      });
      return deferred.promise;
    };

    self.zoomOut = function(amount) {
      var deferred = $q.defer();
      amount = amount || 0.2;
      scale = parseFloat(scale) - amount;
      scale = (scale > 0) ? scale : 0.1;
      renderPage(currentPage).then(function() {
        deferred.resolve(scale);
      });
      return deferred.promise;
    };

    self.zoomTo = function(zoomToScale) {
      var deferred = $q.defer();
      zoomToScale = (zoomToScale) ? zoomToScale : 1.0;
      scale = parseFloat(zoomToScale);
      renderPage(currentPage).then(function() {
        deferred.resolve(scale);
      });
      return deferred.promise;
    };

    self.rotate = function() {
      var deferred = $q.defer();
      if (angle === 0) {
        angle = 90;
      } else if (angle === 90) {
        angle = 180;
      } else if (angle === 180) {
        angle = 270;
      } else {
        angle = 0
      }
      transform();

      // synchronous but return a promise for consistency
      deferred.resolve(angle);
      return deferred.promise;
    };

    self.getPageCount = function() {
      return $scope.pageCount;
    };

    self.getCurrentPage = function () {
      return currentPage;
    };

    self.getScale = function() {
      var h = canvas.height,
          w = canvas.width,
          s = scale;
      return {
        height: h,
        width: w,
        scale: s
      }
    };

    self.goToPage = function(newVal, options) {
      if (pdfDoc !== null) {
        var deferred = $q.defer();
        navigationOptions(options);
        currentPage = newVal;
        renderPage(newVal).then(function() {
          deferred.resolve(currentPage);
        });
        return deferred.promise;
      }
    };



    self.load = function(_url) {
      if (_url) {
        url = _url;
      }

      var docInitParams = {},
          deferred = $q.defer();;

      if (headers) {
        docInitParams.url = url;
        docInitParams.httpHeaders = headers;
      } else {
        docInitParams.url = url;
      }

      PDFJS
        .getDocument(docInitParams)
        .then(function (_pdfDoc) {

          pdfDoc = _pdfDoc;
          renderPage(1).then(function() {
            pdfEventService.broadcast('documentLoaded');
            deferred.resolve();
          });
          $scope.$apply(function() {
            $scope.pageCount = _pdfDoc.numPages;
          });

        }, $log.error);

      return deferred.promise;
    };

    self.load();
}]);
