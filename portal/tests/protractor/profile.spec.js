'use strict';
var util = require('./util');
describe('Test User Profile', function () {

  var newUser = 'sfeldman+apijeeps2@apigee.com';
  beforeEach(function(){
    util.login();
  })
  describe('Test Changing profile values',function(){
    if(browser.params.useSso){
      //this will not work with sso since its an enterprise config.
      return;
    }
    it('should set email to some random value',function(){
      browser.driver.get(browser.baseUrl+'/#!/profile');
      element(by.id('account-link')).click();
      element(by.model('user.email')).isPresent().then(function() {
        element(by.id('account-link')).click();
        element(by.id('profile-link')).click();
        var email = element(by.model('user.email'));
        var name = element(by.model('user.name'));
        email.clear();
        email.sendKeys(newUser);
        name.clear();
        name.sendKeys('rod simpson');
        element(by.id('button-update-account')).submit();
      });
      browser.wait(function() {
        return element(by.id('userEmail')).getText().then(function(text) {
          var test =  text === newUser;
          if(test){
            var name = element(by.model('user.name'));
            expect(name.getAttribute('value')).toEqual('rod simpson');
          }
          return test;
        });
      });

    })
    it('should set my email back',function(){
      element(by.model('user.email')).isPresent().then(function(){
        var email = element(by.model('user.email'));
        email.clear();
        email.sendKeys(browser.params.login.user);
        var name = element(by.model('user.name'));
        name.clear();
        name.sendKeys('sam jeeps');
        element(by.id('button-update-account')).submit();
      })
      browser.wait(function() {
        return element(by.id('userEmail')).getText().then(function(text) {
          var test =  text === browser.params.login.user;
          if(test){
            var name = element(by.model('user.name'));
            expect(name.getAttribute('value')).toEqual('sam jeeps');
          }
          return test;
        });
      });
    })
  });

  describe('Test change password',function(){
    it('should change password to some value',function(){
      browser.driver.get(browser.baseUrl+'/#!/org-overview');
      browser.driver.get(browser.baseUrl+'/#!/profile');
      var email = element(by.model('user.email'));
      email.isPresent().then(function() {
        expect(email.getAttribute('value')).toEqual(browser.params.login.user);
      });
    });
  });
});