/* eslint-disable camelcase */
const github = require('@actions/github');
const core = require('@actions/core');
const backoff = require('exponential-backoff');

async function listRunArtifacts(owner, repo, run_id, octokit) {
  const listWorkflowRunArtifactsResponse = await octokit.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id
  });
  return listWorkflowRunArtifactsResponse.data.artifacts;
}

function NoArtifactsFoundErr() {
  this.name = 'NoArtifactsFoundErr';
  this.message = 'no artifacts found';
}
NoArtifactsFoundErr.prototype = Error.prototype;

async function checkRunArtifactsCount(owner, repo, run_id, octokit) {
  const artifacts = await listRunArtifacts(owner, repo, run_id, octokit);
  if (artifacts.length < 1) {
    throw new NoArtifactsFoundErr();
  }
}

async function deleteArtifacts(owner, repo, artifact_id, octokit) {
  const deleteArtifactResponse = await octokit.actions.deleteArtifact({
    owner,
    repo,
    artifact_id
  });
  /* eslint-disable no-console */
  console.debug(`status: ${deleteArtifactResponse.status}`);
  /* eslint-enable no-console */
}

async function run() {
  try {
    const parentRepo = core.getInput('parent_repo');
    const parent_runid = core.getInput('parent_runid');
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
    const owner = parentRepo.split('/')[0];
    const repo = parentRepo.split('/')[1];
    const run_id = parent_runid;
    try {
      // work around github caching issues: retry for ~4 mins if we don't see artifacts
      await backoff.backOff(() => checkRunArtifactsCount(owner, repo, run_id, octokit), {
        startingDelay: 1000,
        delayFirstAttempt: false,
        numOfAttempts: 9,
        timeMultiple: 2
      });
    } catch (error) {
      if (error.name === 'NoArtifactsFoundErr') {
        /* eslint-disable no-console */
        console.log('🎉 no artifacts found');
        /* eslint-enable no-console */
        return;
      }
      core.setFailed(error.message);
      throw error;
    }

    let artifacts = await listRunArtifacts(owner, repo, run_id, octokit);
    /* eslint-disable no-console */
    console.log(`artifacts before deletion: ${artifacts.length}`);
    /* eslint-enable no-console */
    /* eslint-disable no-restricted-syntax */
    for (const artifact of artifacts) {
      /* eslint-disable no-console */
      console.debug(`processing artifact: ${artifact.name}`, artifact.id);
      /* eslint-enable no-console */
      /* eslint-disable no-await-in-loop */
      await deleteArtifacts(owner, repo, artifact.id, octokit);
      /* eslint-enable no-await-in-loop */
    }
    /* eslint-enable no-restricted-syntax */
    artifacts = await listRunArtifacts(owner, repo, run_id, octokit);
    /* eslint-disable no-console */
    console.log(`artifacts after deletion: ${artifacts.length}`);
    /* eslint-enable no-console */
    if (artifacts.length > 0) {
      throw Error(`🛑 not all artifacts deleted (${artifacts.length} remaining)`);
    } else {
      /* eslint-disable no-console */
      /*       if (Math.floor(Math.random() * 3) != 0) {
              throw Error(`🛑 intentional test error`);
            } */
      console.log('🎉 all artifacts deleted');
      /* eslint-enable no-console */
    }
  } catch (error) {
    /* eslint-disable no-console */
    console.log(`⚠️ error in run: ${error.message}`);
    /* eslint-enable no-console */
    throw error;
  }
}

async function main() {
  try {
    // retry for up to 21 min
    await backoff.backOff(() => run(), {
      startingDelay: 10000,
      delayFirstAttempt: false,
      numOfAttempts: 8,
      timeMultiple: 2
    });
  } catch (error) {
    core.setFailed(error.message);
    throw error;
  }
}

main();

/* eslint-enable camelcase */
