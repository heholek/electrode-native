// @flow

import {
  Dependency,
  DependencyPath,
  NativeApplicationDescriptor
} from 'ern-util'
import {
  cauldron,
  MiniApp
} from 'ern-core'
import utils from '../lib/utils'
import _ from 'lodash'

exports.command = 'cauldron'
exports.desc = 'Cauldron free form command'

exports.builder = function (yargs: any) {
  return yargs
    .option('addDependencies', {
      type: 'array',
      describe: 'Adds one or more native dependencies to a native application version'
    })
    .option('addMiniapps', {
      type: 'array',
      describe: 'Adds one or more MiniApps to a native application version'
    })
    .option('delDependencies', {
      type: 'array',
      describe: 'Remove one or more native dependencies from a native application version'
    })
    .option('delMiniapps', {
      type: 'array',
      describe: 'Remove one or more MiniApps from a native application version'
    })
    .option('updateDependencies', {
      type: 'array',
      describe: 'Update one or more native dependencies versions in a native application version'
    })
    .option('updateMiniapps', {
      type: 'array',
      describe: 'Update one or more MiniApps versions in a native appplication version'
    })
    .option('force', {
      alias: 'f',
      type: 'bool',
      describe: 'Force the operations even if some compatibility checks are failing'
    })
    .option('containerVersion', {
      alias: 'v',
      type: 'string',
      describe: 'Version to use for generated container. If none provided, current container version will be patch bumped.'
    })
    .option('descriptor', {
      type: 'string',
      alias: 'd',
      describe: 'A complete native application descriptor target of the operation'
    })
    .commandDir('cauldron')
    .epilog(utils.epilog(exports))
}

exports.handler = async function ({
  addDependencies = [],
  addMiniapps = [],
  delDependencies = [],
  delMiniapps = [],
  updateDependencies = [],
  updateMiniapps = [],
  force,
  containerVersion,
  descriptor
} : {
  addDependencies: Array<string>,
  addMiniapps: Array<string>,
  delDependencies: Array<string>,
  delMiniapps: Array<string>,
  updateDependencies: Array<string>,
  updateMiniapps: Array<string>,
  force?: boolean,
  containerVersion?: string,
  descriptor?: string
}) {
  if (!descriptor) {
    descriptor = await utils.askUserToChooseANapDescriptorFromCauldron({ onlyNonReleasedVersions: true })
  }
  const napDescriptor = NativeApplicationDescriptor.fromString(descriptor)

  await utils.logErrorAndExitIfNotSatisfied({
    isCompleteNapDescriptorString: { descriptor },
    isValidContainerVersion: containerVersion ? { containerVersion } : undefined,
    isNewerContainerVersion: containerVersion ? {
      containerVersion,
      descriptor,
      extraErrorMessage: 'To avoid conflicts with previous versions, you can only use container version newer than the current one'
    } : undefined,
    noGitOrFilesystemPath: {
      obj: [ ...addDependencies, ...addMiniapps, ...delDependencies, ...delMiniapps, ...updateDependencies, ...updateMiniapps ],
      extraErrorMessage: 'You cannot provide dependency(ies) or MiniApp(s) using git or file scheme for this command. Only the form name@version is allowed.'
    },
    napDescriptorExistInCauldron: {
      descriptor,
      extraErrorMessage: 'This command cannot work on a non existing native application version'
    },
    dependencyIsInNativeApplicationVersionContainer: {
      dependency: [ ...delDependencies, ...updateDependencies ],
      napDescriptor,
      extraErrorMessahe: 'This command cannot del or update dependency(ies) that do not exist in Cauldron.'
    },
    dependencyIsInNativeApplicationVersionContainerWithDifferentVersion: {
      dependency: updateDependencies,
      napDescriptor,
      extraErrorMessage: 'It seems like you are trying to update a dependency to a version that is already the one in use.'
    },
    dependencyNotInNativeApplicationVersionContainer: {
      dependency: addDependencies,
      napDescriptor,
      extraErrorMessage: 'You cannot add dependencies that already exit in Cauldron. Please consider using update instead.'
    },
    dependencyNotInUseByAMiniApp: {
      dependency: [ ...delDependencies ],
      napDescriptor
    },
    miniAppIsInNativeApplicationVersionContainer: {
      miniApp: [ ...delMiniapps, ...updateMiniapps ],
      napDescriptor,
      extraErrorMessahe: 'This command cannot remove MiniApp(s) that do not exist in Cauldron.'
    },
    miniAppIsInNativeApplicationVersionContainerWithDifferentVersion: {
      miniApp: updateMiniapps,
      napDescriptor,
      extraErrorMessage: 'It seems like you are trying to update a MiniApp to a version that is already the one in use.'
    },
    miniAppNotInNativeApplicationVersionContainer: {
      miniApp: addMiniapps,
      napDescriptor,
      extraErrorMessage: 'You cannot add MiniApp(s) that already exist yet in Cauldron. Please consider using update instead.'
    },
    publishedToNpm: {
      obj: [ ...addDependencies, ...addMiniapps, ...updateDependencies, ...updateMiniapps ],
      extraErrorMessage: 'You can only add or update dependency(ies) or MiniApp(s) wtih version(s) that have been published to NPM'
    }
  })

  const addDependenciesObjs = _.map(addDependencies, d => Dependency.fromString(d))
  const delDependenciesObjs = _.map(delDependencies, d => Dependency.fromString(d))
  const delMiniAppsAsDeps = _.map(delMiniapps, m => Dependency.fromString(m))
  const updateDependenciesObjs = _.map(updateDependencies, d => Dependency.fromString(d))

  let updateMiniAppsObjs = []
  const updateMiniAppsDependencyPaths = _.map(updateMiniapps, m => DependencyPath.fromString(m))
  for (const updateMiniAppDependencyPath of updateMiniAppsDependencyPaths) {
    const m = await MiniApp.fromPackagePath(updateMiniAppDependencyPath)
    updateMiniAppsObjs.push(m)
  }

  let addMiniAppsObjs = []
  // An array of miniapps strings was provided
  const addMiniAppsDependencyPaths = _.map(addMiniapps, m => DependencyPath.fromString(m))
  for (const addMiniAppDependencyPath of addMiniAppsDependencyPaths) {
    const m = await MiniApp.fromPackagePath(addMiniAppDependencyPath)
    addMiniAppsObjs.push(m)
  }

  try {
    await utils.performContainerStateUpdateInCauldron(async () => {
      // Del Dependencies
      for (const delDependencyObj of delDependenciesObjs) {
        await cauldron.removeNativeDependency(napDescriptor, delDependencyObj)
      }
      // Del MiniApps
      for (const delMiniAppAsDep of delMiniAppsAsDeps) {
        await cauldron.removeMiniAppFromContainer(napDescriptor, delMiniAppAsDep)
      }
      // Update Dependencies
      for (const updateDependencyObj of updateDependenciesObjs) {
        await cauldron.updateNativeAppDependency(
          napDescriptor,
          updateDependencyObj.withoutVersion().toString(),
          updateDependencyObj.version)
      }
      // Update MiniApps
      for (const updateMiniAppObj of updateMiniAppsObjs) {
        // Add the MiniApp (and all it's dependencies if needed) to Cauldron
        await updateMiniAppObj.addToNativeAppInCauldron(napDescriptor, force)
      }
      // Add Dependencies
      for (const addDependencyObj of addDependenciesObjs) {
        // Add the dependency to Cauldron
        await cauldron.addNativeDependency(napDescriptor, addDependencyObj)
      }
      // Add MiniApps
      for (const addMiniAppObj of addMiniAppsObjs) {
        // Add the MiniApp (and all it's dependencies if needed) to Cauldron
        await addMiniAppObj.addToNativeAppInCauldron(napDescriptor, force)
      }
    }, napDescriptor, { containerVersion })
    log.info(`Operations were succesfully performed for ${napDescriptor.toString()}`)
  } catch (e) {
    log.error(`An error happened while trying to remove dependency(ies) from ${napDescriptor.toString()}`)
  }
}
