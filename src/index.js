/* eslint-disable camelcase */
const github = require('@actions/github');
const core = require('@actions/core');

async function listRunArtifacts(owner, repo, run_id, octokit) {
  const listWorkflowRunArtifactsResponse = await octokit.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id
  });
  return listWorkflowRunArtifactsResponse.data.artifacts;
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

async function amain() {
  try {
    const parentRepo = core.getInput('parent_repo');
    const parent_runid = core.getInput('parent_runid');
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
    const owner = parentRepo.split('/')[0];
    const repo = parentRepo.split('/')[1];
    const run_id = parent_runid;
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
      console.log('🎉 all artifacts deleted');
      /* eslint-enable no-console */
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

try {
  amain();
} catch (error) {
  core.setFailed(error.message);
}
/* eslint-enable camelcase */
