   const { withProjectBuildGradle } = require('expo/config-plugins');

   module.exports = function withFirebaseBom(config, { bom }) {
     return withProjectBuildGradle(config, (config) => {
       config.modResults.contents += `
   project.ext {
     set('react-native', [versions: [firebase: [bom: '${bom}']]])
   }
   `;
       return config;
     });
   };