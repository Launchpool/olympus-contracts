// @dev. This script will deploy this V1.1 of Olympus. It will deploy the whole ecosystem except for the LP tokens and their bonds.
// This should be enough of a test environment to learn about and test implementations with the Olympus as of V1.1.
// Not that the every instance of the Treasury's function 'valueOf' has been changed to 'valueOfToken'...
// This solidity function was conflicting w js object property name

const { ethers } = require('hardhat')

async function main () {
  const [deployer] = await ethers.getSigners()
  const MockDAO = deployer
  console.log('Deploying contracts with the account: ' + deployer.address)

  // Initial staking index
  const initialIndex = '7675210820'

  // First block epoch occurs
  const firstEpochBlock = '8961000'

  // What epoch will be first epoch
  const firstEpochNumber = '338'

  // How many blocks are in each epoch
  const epochLengthInBlocks = '2200'

  // Initial reward rate for epoch
  const initialRewardRate = '3000'

  // Ethereum 0 address, used when toggling changes in treasury
  const zeroAddress = '0x0000000000000000000000000000000000000000'

  // Large number for approval for Frax and DAI
  const largeApproval = '100000000000000000000000000000000'

  // Initial mint for Frax and DAI (10,000,000)
  const initialMint = '10000000000000000000000000'

  // DAI bond BCV
  const daiBondBCV = '369'

  // Bond vesting length in blocks. 33110 ~ 5 days
  const bondVestingLength = '33110'

  // Min bond price
  const minBondPrice = '50000'

  // Max bond payout
  const maxBondPayout = '50'

  // DAO fee for bond
  const bondFee = '10000'

  // Max debt bond can take on
  const maxBondDebt = '1000000000000000'

  // Initial Bond debt
  const intialBondDebt = '0'

  // Deploy OHM
  const OHM = await ethers.getContractFactory('OlympusERC20Token')
  const ohm = await OHM.deploy()
  await ohm.deployed()
  console.log('ohm address:', ohm.address)

  // Deploy DAI
  const DAI = await ethers.getContractFactory('DAI')
  const dai = await DAI.deploy(0)
  await dai.deployed()
  console.log('dai address:', dai.address)

  // Deploy 10,000,000 mock DAI
  const tx = await dai.mint(deployer.address, initialMint)
  await tx.wait()

  // Deploy treasury
  //@dev changed function in treaury from 'valueOf' to 'valueOfToken'... solidity function was coflicting w js object property name
  const Treasury = await ethers.getContractFactory('MockOlympusTreasury')
  const treasury = await Treasury.deploy(ohm.address, dai.address, 0)
  await treasury.deployed()
  console.log('treasury address:', treasury.address)

  // Deploy bonding calc
  const OlympusBondingCalculator = await ethers.getContractFactory(
    'OlympusBondingCalculator'
  )
  const olympusBondingCalculator = await OlympusBondingCalculator.deploy(
    ohm.address
  )
  await olympusBondingCalculator.deployed()
  console.log(
    'olympusBondingCalculator address:',
    olympusBondingCalculator.address
  )

  // Deploy staking distributor
  const Distributor = await ethers.getContractFactory('Distributor')
  const distributor = await Distributor.deploy(
    treasury.address,
    ohm.address,
    epochLengthInBlocks,
    firstEpochBlock
  )
  await distributor.deployed()
  console.log('distributor address:', distributor.address)

  // Deploy sOHM
  const SOHM = await ethers.getContractFactory('sOlympus')
  const sOHM = await SOHM.deploy()
  await sOHM.deployed()
  console.log('sOHM address:', sOHM.address)

  // Deploy Staking
  const Staking = await ethers.getContractFactory('OlympusStaking')
  const staking = await Staking.deploy(
    ohm.address,
    sOHM.address,
    epochLengthInBlocks,
    firstEpochNumber,
    firstEpochBlock
  )
  await staking.deployed()
  console.log('staking address:', staking.address)

  // Deploy staking warmpup
  const StakingWarmpup = await ethers.getContractFactory('StakingWarmup')
  const stakingWarmup = await StakingWarmpup.deploy(
    staking.address,
    sOHM.address
  )
  await stakingWarmup.deployed()
  console.log('stakingWarmup address:', stakingWarmup.address)

  // Deploy staking helper
  const StakingHelper = await ethers.getContractFactory('StakingHelper')
  const stakingHelper = await StakingHelper.deploy(staking.address, ohm.address)
  await stakingHelper.deployed()
  // Deploy DAI bond
  //@dev changed function call to Treasury of 'valueOf' to 'valueOfToken' in BondDepository due to change in Treausry contract
  const DAIBond = await ethers.getContractFactory('MockOlympusBondDepository')
  const daiBond = await DAIBond.deploy(
    ohm.address,
    dai.address,
    treasury.address,
    MockDAO.address,
    zeroAddress
  )
  await daiBond.deployed()
  console.log('daiBond address:', daiBond.address)

  // queue and toggle DAI bond reserve depositor
  const tx2 = await treasury.queue('0', daiBond.address)
  await tx2.wait()
  console.log('DAI bond reserve depositor queued')
  const tx3 = await treasury.toggle('0', daiBond.address, zeroAddress)
  await tx3.wait()
  console.log('DAI bond reserve depositor toggled')

  // Set DAI bond terms
  const tx4 = await daiBond.initializeBondTerms(
    daiBondBCV,
    bondVestingLength,
    minBondPrice,
    maxBondPayout,
    bondFee,
    maxBondDebt,
    intialBondDebt
  )
  await tx4.wait()
  console.log('DAI bond terms set')

  // Set staking for DAI bond
  const tx5 = await daiBond.setStaking(staking.address, stakingHelper.address)
  await tx5.wait()
  console.log('DAI bond staking set')

  // Initialize sOHM and set the index
  const tx6 = await sOHM.initialize(staking.address)
  await tx6.wait()
  console.log('sOHM initialized')
  const tx7 = await sOHM.setIndex(initialIndex)
  await tx7.wait()
  console.log('sOHM index set')

  // set distributor contract and warmup contract
  const tx8 = await staking.setContract('0', distributor.address)
  await tx8.wait()
  console.log('staking distributor set')
  const tx9 = await staking.setContract('1', stakingWarmup.address)
  await tx9.wait()
  console.log('staking warmup set')

  // Set treasury for OHM token
  const tx10 = await ohm.setVault(treasury.address)
  await tx10.wait()
  console.log('OHM vault set')

  // Add staking contract as distributor recipient
  const tx11 = await distributor.addRecipient(
    staking.address,
    initialRewardRate
  )
  await tx11.wait()
  console.log('staking added as distributor reward recipient')

  // queue and toggle reward manager
  const tx12 = await treasury.queue('8', distributor.address)
  await tx12.wait()
  console.log('distributor queued')
  const tx13 = await treasury.toggle('8', distributor.address, zeroAddress)
  await tx13.wait()
  console.log('distributor toggled')

  // queue and toggle deployer reserve depositor
  const tx14 = await treasury.queue('0', deployer.address)
  await tx14.wait()
  console.log('deployer queued')
  const tx15 = await treasury.toggle('0', deployer.address, zeroAddress)
  await tx15.wait()
  console.log('deployer toggled')

  // queue and toggle liquidity depositor
  const tx16 = await treasury.queue('4', deployer.address)
  await tx16.wait()
  console.log('liquidity depositor queued')
  const tx17 = await treasury.toggle('4', deployer.address, zeroAddress)
  await tx17.wait()
  console.log('liquidity depositor toggled')

  // Approve the treasury to spend DAI
  const tx18 = await dai.approve(treasury.address, largeApproval)
  await tx18.wait()
  console.log('DAI approved')

  // Approve dai bonds to spend deployer's DAI
  const tx19 = await dai.approve(daiBond.address, largeApproval)
  await tx19.wait()
  console.log('DAI bond approved')

  // Approve staking and staking helper contact to spend deployer's OHM
  const tx20 = await ohm.approve(staking.address, largeApproval)
  await tx20.wait()
  console.log('OHM staking approved')
  const tx21 = await ohm.approve(stakingHelper.address, largeApproval)
  await tx21.wait()
  console.log('OHM staking helper approved')

  // Deposit 9,000,000 DAI to treasury, 600,000 OHM gets minted to deployer and 8,400,000 are in treasury as excesss reserves
  const tx22 = await treasury.deposit(
    '9000000000000000000000000',
    dai.address,
    '8400000000000000'
  )
  await tx22.wait()
  console.log('9,000,000 DAI deposited')
  // Stake OHM through helper
  const tx23 = await stakingHelper.stake('100000000000')
  await tx23.wait()
  console.log('OHM staked')

  // Bond 1,000 OHM  in each of their bonds
  const tx24 = await daiBond.deposit(
    '1000000000000000000000',
    '60000',
    deployer.address
  )
  await tx24.wait()
  console.log('1,000 OHM deposited in DAI bond')

  console.log('OHM: ' + ohm.address)
  console.log('DAI: ' + dai.address)
  console.log('Treasury: ' + treasury.address)
  console.log('Calc: ' + olympusBondingCalculator.address)
  console.log('Staking: ' + staking.address)
  console.log('sOHM: ' + sOHM.address)
  console.log('Distributor ' + distributor.address)
  console.log('Staking Wawrmup ' + stakingWarmup.address)
  console.log('Staking Helper ' + stakingHelper.address)
  console.log('DAI Bond: ' + daiBond.address)
}

main()
  .then(() => process.exit())
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
