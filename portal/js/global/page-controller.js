'use strict'

AppServices.Controllers.controller('PageCtrl',
  [ 'data',
    'ug',
    'utility',
    '$scope',
    '$rootScope',
    '$location',
    '$routeParams',
    '$q',
    '$route',
    '$log',
    '$analytics', function (data,
                     ug,
                     utility,
                     $scope,
                     $rootScope,
                     $location,
                     $routeParams,
                     $q,
                     $route,
                     $log
                     ) {

  var initScopeVariables = function(){
    //$rootScope.urls()... will determine which URL should be used for a given environment
    $scope.loadingText = 'Loading...';
    $scope.use_sso = false;
    $scope.newApp = {name: ''};
    $scope.getPerm = '';
    $scope.postPerm = '';
    $scope.putPerm = '';
    $scope.deletePerm = '';
    $scope.usersTypeaheadValues = [];
    $scope.groupsTypeaheadValues = [];
    $scope.rolesTypeaheadValues = [];
    $rootScope.sdkActive = false;
    $rootScope.demoData = false;
    $scope.queryStringApplied = false;
    $rootScope.loaded = $rootScope.activeUI = false;
    for (var key in Usergrid.regex) {
      $scope[key] = Usergrid.regex[key];
    }

    $scope.options = Usergrid.options;

    var getQuery = function () {
      var result = {}, queryString = location.search.slice(1),
          re = /([^&=]+)=([^&]*)/g, m;
      while (m = re.exec(queryString)) {
        result[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
      }
      return result;
    };
    $scope.queryString = getQuery();
  };

  initScopeVariables();

  $rootScope.urls = function(){
    var BASE_URL = '';
    var DATA_URL = '';
    var qs = $location.search();

    switch(true){
      case $location.host() === 'appservices.apigee.com' && location.pathname.indexOf('/dit') >= 0 :
        //DIT
        BASE_URL = 'https://accounts.jupiter.apigee.net';
        DATA_URL = 'http://apigee-internal-prod.jupiter.apigee.net';
        $scope.use_sso = true;
        break;
      case $location.host() === 'appservices.apigee.com' && location.pathname.indexOf('/mars') >= 0  :
        //staging
        BASE_URL = 'https://accounts.mars.apigee.net';
        DATA_URL = 'http://apigee-internal-prod.mars.apigee.net';
        $scope.use_sso = true;
        break;
      case $location.host() === 'appservices.apigee.com' :
        //enterprise portals
        DATA_URL = Usergrid.overrideUrl;
        break;
      case $location.host() === 'apigee.com' :
        //prod
        BASE_URL = 'https://accounts.apigee.com';
        DATA_URL = 'https://api.usergrid.com';
        $scope.use_sso = true;
        break;
      case $location.host() === 'usergrid.dev':
        //development
        DATA_URL = 'https://api.usergrid.com';
        break;
      default :
        DATA_URL = Usergrid.overrideUrl;
        break;
    }
    //override with querystring
    DATA_URL =  qs.api_url || DATA_URL;
    $scope.apiUrl = DATA_URL = DATA_URL.lastIndexOf('/') === DATA_URL.length - 1 ? DATA_URL.substring(0,DATA_URL.length-1) : DATA_URL;

    return {
      DATA_URL: DATA_URL,
      LOGIN_URL: BASE_URL + '/accounts/sign_in',
      PROFILE_URL: BASE_URL + '/accounts/my_account',
      LOGOUT_URL: BASE_URL + '/accounts/sign_out'
    }
  }

  //used in users
  $rootScope.gotoPage = function(path){
    $location.path(path);
  }

  var notRegistration = function(){
    return  "/forgot-password"!==$location.path() && "/register"!==$location.path();
  };

    //called in ng-init on main index page (first method called at app startup and every main navigation)
  var verifyUser = function(){
    //avoid polluting our target route with login path
     if ($location.path().slice(0, '/login'.length) !== '/login') {
       $rootScope.currentPath = $location.path();
       //show loading screen during verify process
       //      $location.path('/login/loading');
     }

     //first check to see if there is a token in the query string, if so, save it
     if ($routeParams.access_token && $routeParams.admin_email && $routeParams.uuid) {
       ug.set('token', $routeParams.access_token);
       ug.set('email', $routeParams.admin_email);
       ug.set('uuid', $routeParams.uuid);
       $location.search('access_token', null);
       $location.search('admin_email', null);
       $location.search('uuid', null);
     }

     $scope.deferredLogin = $q.defer();
     //use a promise so we can update afterwards in other UI areas
     //next try to quick login
     ug.checkAuthentication();
  };


    $scope.profile = function(){
      if($scope.use_sso){
        window.location = $rootScope.urls().PROFILE_URL + '?callback=' + encodeURIComponent($location.absUrl());
      }else{
        $location.path('/profile')
      }

    };

    $scope.showModal = function(id){
      $('#' + id).modal('show')
    };

    $scope.hideModal = function(id){
      $('#' + id).modal('hide')
    };


    //adding this here for now
    //todo - create a controller for usergrid functionality where all UG pages inherit
    $scope.deleteEntities = function(collection, successBroadcast, errorMessage) {
      collection.resetEntityPointer();
      var entitiesToDelete = []
      while(collection.hasNextEntity()) {
        var entity = collection.getNextEntity();
        var checked = entity.checked;
        if(checked){
          entitiesToDelete.push(entity);
        }
      }
      var count = 0,success=false;
      for(var i=0; i<entitiesToDelete.length; i++) {
        var entity = entitiesToDelete[i];
        collection.destroyEntity(entity, function(err){
          count++;
          if(err){
            $rootScope.$broadcast('alert', 'error', errorMessage);
            $rootScope.$broadcast(successBroadcast+'-error',err);
          }else{
            success=true;
          }

          if(count===entitiesToDelete.length){
            success && $rootScope.$broadcast(successBroadcast);
            $scope.applyScope();
          }
        });
      }
    };

    $scope.selectAllEntities = function(list,that,varName,setValue){
      varName = varName || 'master';
      var val = that[varName] ;
      if(setValue == undefined){
        setValue = true;
      }

      if(setValue){
        that[varName] = val = !val;
      }
      list.forEach(function(entitiy){
        entitiy.checked = val;
      });
    };


    $scope.createPermission = function(type, entity, path, permissions) {
      //e.g.: "get,post,put:/mypermission"
//      var path = $scope.path;

      if(path.charAt(0) != '/') {
        path = '/'+path;
      }
      var ops = "";
      var s = "";
      if (permissions.getPerm) {
        ops = "get";
        s = ",";
      }
      if (permissions.postPerm) {
        ops = ops + s + "post";
        s = ",";
      }
      if (permissions.putPerm) {
        ops =  ops + s + "put";
        s = ",";
      }
      if (permissions.deletePerm) {
        ops =  ops + s + "delete";
        s = ",";
      }
      var permission = ops + ":" + path;

      return permission
    };

    $scope.formatDate = function(date){
      return new Date(date).toUTCString();
    };

    $scope.clearCheckbox = function(id){
      if($('#'+id).attr('checked')){
        $('#'+id).click();
      }
    };

    $scope.removeFirstSlash = function(path){
      return path.indexOf('/') === 0 ?  path.substring(1,path.length): path;
    };

    $scope.applyScope = function(cb){
      cb = typeof cb === 'function' ? cb : function(){};
      if(!this.$$phase) {
        return this.$apply(cb);
      }else{
        cb();
      }
    }

    $scope.valueSelected = function(list){
      return list &&  (list.some(function(item){return item.checked;}));
    };

    $scope.$on('users-typeahead-received', function(event, users) {
      $scope.usersTypeaheadValues = users;
      if(!$scope.$$phase) {
        $scope.$apply();
      }
    });
    $scope.$on('groups-typeahead-received', function(event, groups) {
      $scope.groupsTypeaheadValues = groups;
      if(!$scope.$$phase) {
        $scope.$apply();
      }
    });
    $scope.$on('roles-typeahead-received', function(event, roles) {
      $scope.rolesTypeaheadValues = roles;
      if(!$scope.$$phase) {
        $scope.$apply();
      }
    });

    $scope.$on('checkAuthentication-success', function () {
      //all is well - repopulate objects
      $scope.loaded = true;
      $rootScope.activeUI = true;
      $scope.applyScope();


      if(!$scope.queryStringApplied){
        $scope.queryStringApplied = true;
        setTimeout(function(){
          //if querystring exists then operate on it.
          if ($scope.queryString.org) {
            $rootScope.$broadcast('change-org',$scope.queryString.org);
          }
        }, 1000)
      }

      $scope.deferredLogin && $scope.deferredLogin.resolve();
      $rootScope.$broadcast('app-initialized');

      //boolean defines is top level ui menus/buttons should be active/shown
    });

    $scope.$on('checkAuthentication-error', function (args,err, missingData,email) {
      $scope.loaded = true;
      if (err && !$scope.use_sso && notRegistration()) {
        //there was an error on re-auth lite, immediately send to login
        ug.logout();
        $location.path('/login');
        $scope.applyScope();
      } else {
        if (missingData && notRegistration()) {
          if (!email && $scope.use_sso) {
            window.location = $rootScope.urls().LOGIN_URL + '?callback=' +  encodeURIComponent($location.absUrl().split('?')[0]);
            return;
          }
          ug.reAuthenticate(email);
        }
      }
    });

    $scope.$on('reAuthenticate-success', function (args,err, data, user, organizations, applications) {

      //the user is authenticated
      $rootScope.$broadcast('loginSuccesful', user, organizations, applications);
      $rootScope.$emit('loginSuccesful', user, organizations, applications);
      $rootScope.$broadcast('checkAuthentication-success');
      $scope.applyScope(function () {
        $scope.deferredLogin.resolve();
        $location.path('/org-overview');
      })
    });

    $scope.$on('reAuthenticate-error', function () {
      //user is not authenticated, send to SSO if enabled
      if ($scope.use_sso) {
        //go to sso
        window.location = $rootScope.urls().LOGIN_URL + '?callback=' +  encodeURIComponent($location.absUrl().split('?')[0]);
      } else {
        //go to login page
        if (notRegistration()) {
          ug.logout();
          $location.path('/login');
          $scope.applyScope();
        }
      }
    });

    $scope.$on('loginSuccessful',function(){
      $rootScope.activeUI = true;
    });

    $scope.$on('app-changed',function(args,oldVal,newVal,preventReload){
      if(newVal!==oldVal && !preventReload){
        $route.reload();
      }
    });

    $scope.$on('org-changed',function(args, oldOrg,newOrg){
      ug.getApplications();
      $route.reload();
    });

    $scope.$on('app-settings-received',function(evt,data){
    });


    //verify on every route change
    $scope.$on('$routeChangeSuccess', function () {
      //todo possibly do a date check here for token expiry
      //so we don't call this on every nav change
      verifyUser();
      $scope.showDemoBar = $location.path().slice(0,'/performance'.length) === '/performance';
      if(!$scope.showDemoBar){
        $rootScope.demoData = false;
      }
    });
    $scope.$on('applications-received', function (event, applications) {
      $scope.applications = applications;
      $scope.hasApplications = Object.keys(applications).length > 0;
    });

    //init app
    ug.getAppSettings();

  }]);

