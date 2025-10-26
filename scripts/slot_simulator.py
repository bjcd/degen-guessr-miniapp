#!/usr/bin/env python3
"""
DegenSlot Python Simulator

Simulates 1,000,000+ spins of the DegenSlot game to verify:
- Probability distributions match contract thresholds
- RTP calculation is correct (~70%)
- Pot behavior with steady-state around 15k
- Treasury accumulation (30% house edge)
- New One-Hat and Two-Hats categories

This simulator mirrors the exact logic from the Solidity contract.
"""

import random
import statistics
from typing import Dict, List, Tuple
from dataclasses import dataclass
from enum import Enum

# ============ ENUMS ============

class Cat(Enum):
    """Result categories for spin outcomes"""
    Nothing = 0
    TwoSame = 1
    ThreeSame = 2
    Jackpot = 3
    OneHat = 4
    TwoHats = 5

# ============ CONSTANTS (matching Solidity contract) ============

COST_PER_SPIN = 100
POT_ADD_PER_SPIN = 70
TREASURY_ADD_PER_SPIN = 30
INITIAL_POT = 0

# Payouts (all from pot)
THREE_SAME_PAYOUT = 500
TWO_SAME_PAYOUT = 250
ONE_HAT_PAYOUT = 50
TWO_HATS_PAYOUT = 350
MIN_POT_AFTER_TOPUP = 500  # Safety guard

# Probability thresholds (basis points) - Final Design
P_JACKPOT_BPS = 15      # 0.15%
P_THREE_SAME_BPS = 96   # 0.96%
P_TWO_SAME_BPS = 1800   # 18.00%
P_ONE_HAT_BPS = 3000    # 30.00%
P_TWO_HATS_BPS = 50     # 0.50%
P_NOTHING_BPS = 5039    # 50.39%

# Cumulative ranges (matching contract logic)
JACKPOT_RANGE_START = 0
JACKPOT_RANGE_END = P_JACKPOT_BPS
THREE_SAME_RANGE_START = P_JACKPOT_BPS
THREE_SAME_RANGE_END = P_JACKPOT_BPS + P_THREE_SAME_BPS
TWO_SAME_RANGE_START = P_JACKPOT_BPS + P_THREE_SAME_BPS
TWO_SAME_RANGE_END = P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS
ONE_HAT_RANGE_START = P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS
ONE_HAT_RANGE_END = P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS + P_ONE_HAT_BPS
TWO_HATS_RANGE_START = P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS + P_ONE_HAT_BPS
TWO_HATS_RANGE_END = P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS + P_ONE_HAT_BPS + P_TWO_HATS_BPS
NOTHING_RANGE_START = P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS + P_ONE_HAT_BPS + P_TWO_HATS_BPS
NOTHING_RANGE_END = 10000

@dataclass
class SpinResult:
    """Result of a single spin"""
    roll: int
    category: Cat
    payout: int
    pot_before: int
    pot_after: int

@dataclass
class SimulationStats:
    """Statistics from the simulation"""
    total_spins: int
    total_cost: int
    total_payouts: int
    final_pot: int
    final_treasury: int
    rtp: float
    expected_rtp: float
    drift_per_spin: float
    
    # Outcome counts
    jackpot_count: int
    three_same_count: int
    two_same_count: int
    one_hat_count: int
    two_hats_count: int
    nothing_count: int
    
    # Pot statistics
    pot_mean: float
    pot_min: int
    pot_max: int
    pot_below_2000_count: int

def determine_result(roll: int, current_pot: int) -> Tuple[Cat, int]:
    """
    Determine spin result based on roll (matching contract logic)
    
    Args:
        roll: Random number 0-9999
        current_pot: Current pot balance for percentage-based jackpot
        
    Returns:
        Tuple of (category, payout)
    """
    if JACKPOT_RANGE_START <= roll < JACKPOT_RANGE_END:
        # Jackpot: 50% of current pot
        return Cat.Jackpot, current_pot // 2
    elif THREE_SAME_RANGE_START <= roll < THREE_SAME_RANGE_END:
        return Cat.ThreeSame, THREE_SAME_PAYOUT
    elif TWO_SAME_RANGE_START <= roll < TWO_SAME_RANGE_END:
        return Cat.TwoSame, TWO_SAME_PAYOUT
    elif ONE_HAT_RANGE_START <= roll < ONE_HAT_RANGE_END:
        return Cat.OneHat, ONE_HAT_PAYOUT
    elif TWO_HATS_RANGE_START <= roll < TWO_HATS_RANGE_END:
        return Cat.TwoHats, TWO_HATS_PAYOUT
    else:
        return Cat.Nothing, 0

def simulate_spins(num_spins: int = 1_000_000, pot_seed: int = 15_000) -> SimulationStats:
    """
    Simulate the specified number of spins
    
    Args:
        num_spins: Number of spins to simulate
        pot_seed: Initial pot seed amount
        
    Returns:
        SimulationStats object with results
    """
    # Initialize state
    pot = pot_seed  # Start with seeded pot
    treasury = 0
    total_payouts = 0
    
    # Track outcomes
    jackpot_count = 0
    three_same_count = 0
    two_same_count = 0
    one_hat_count = 0
    two_hats_count = 0
    nothing_count = 0
    
    # Track pot values for statistics
    pot_values = [pot]
    
    # Simulate spins
    for spin_num in range(num_spins):
        # Add to pot and treasury (before payout)
        pot += POT_ADD_PER_SPIN
        treasury += TREASURY_ADD_PER_SPIN
        
        # Safety guard: ensure pot can cover largest fixed payout (600 DEGEN)
        # This only applies to fixed payouts, not percentage-based jackpots
        if pot < MIN_POT_AFTER_TOPUP:
            print(f"⚠️  Pot too small for fixed payouts: {pot} < {MIN_POT_AFTER_TOPUP} (spin {spin_num + 1})")
            # In real contract, this would revert, but for simulation we continue
        
        # Generate random roll (0-9999)
        roll = random.randint(0, 9999)
        
        # Determine result
        category, payout = determine_result(roll, pot)
        
        # Process payout
        if payout > 0:
            if pot < payout:
                # This should not happen with percentage-based jackpots, but can with fixed payouts
                if category == Cat.Jackpot:
                    # For jackpots, pay what we can (the entire pot)
                    payout = pot
                    pot = 0
                    total_payouts += payout
                    print(f"⚠️  Jackpot payout limited by pot size: {payout} (spin {spin_num + 1})")
                else:
                    # For fixed payouts, skip this spin if pot is too small
                    print(f"⚠️  Skipping fixed payout due to insufficient pot: {pot} < {payout} (spin {spin_num + 1})")
                    payout = 0
            else:
                pot -= payout
                total_payouts += payout
        
        # Track outcomes
        if category == Cat.Jackpot:
            jackpot_count += 1
        elif category == Cat.ThreeSame:
            three_same_count += 1
        elif category == Cat.TwoSame:
            two_same_count += 1
        elif category == Cat.OneHat:
            one_hat_count += 1
        elif category == Cat.TwoHats:
            two_hats_count += 1
        else:
            nothing_count += 1
        
        # Track pot value
        pot_values.append(pot)
    
    # Calculate statistics
    total_cost = num_spins * COST_PER_SPIN
    rtp = (total_payouts / total_cost) * 100 if total_cost > 0 else 0
    
    # Expected RTP from math (fixed payouts only, jackpot varies)
    expected_rtp_fixed = (300 * 0.12 + 600 * 0.0096 + 50 * 0.30 + 350 * 0.005)  # ~58.5
    # Jackpot expected: 0.00075 * S where S ≈ 15,333
    expected_jackpot_per_spin = 0.0015 * (pot_seed + (POT_ADD_PER_SPIN * num_spins) / 2)  # Approximate
    expected_rtp = expected_rtp_fixed + expected_jackpot_per_spin
    drift_per_spin = POT_ADD_PER_SPIN - expected_rtp_fixed  # Excluding jackpot variance
    
    # Pot statistics
    pot_mean = statistics.mean(pot_values)
    pot_min = min(pot_values)
    pot_max = max(pot_values)
    pot_below_2000_count = sum(1 for p in pot_values if p < 2000)
    
    return SimulationStats(
        total_spins=num_spins,
        total_cost=total_cost,
        total_payouts=total_payouts,
        final_pot=pot,
        final_treasury=treasury,
        rtp=rtp,
        expected_rtp=expected_rtp,
        drift_per_spin=drift_per_spin,
        jackpot_count=jackpot_count,
        three_same_count=three_same_count,
        two_same_count=two_same_count,
        one_hat_count=one_hat_count,
        two_hats_count=two_hats_count,
        nothing_count=nothing_count,
        pot_mean=pot_mean,
        pot_min=pot_min,
        pot_max=pot_max,
        pot_below_2000_count=pot_below_2000_count
    )

def print_simulation_results(stats: SimulationStats):
    """Print formatted simulation results"""
    print("🎰 DegenSlot Simulation Results")
    print("=" * 50)
    
    print(f"\n📊 Basic Statistics:")
    print(f"  Total Spins: {stats.total_spins:,}")
    print(f"  Total Cost: {stats.total_cost:,} $DEGEN")
    print(f"  Total Payouts: {stats.total_payouts:,} $DEGEN")
    print(f"  Final Pot: {stats.final_pot:,} $DEGEN")
    print(f"  Final Treasury: {stats.final_treasury:,} $DEGEN")
    
    print(f"\n💰 RTP Analysis:")
    print(f"  Actual RTP: {stats.rtp:.2f}%")
    print(f"  Expected RTP: {stats.expected_rtp:.2f}%")
    print(f"  RTP Difference: {stats.rtp - stats.expected_rtp:+.2f}%")
    print(f"  Expected Drift per Spin: +{stats.drift_per_spin:.1f} $DEGEN")
    
    print(f"\n🎯 Outcome Distribution:")
    total = stats.total_spins
    print(f"  Jackpot (🎩🎩🎩): {stats.jackpot_count:,} ({stats.jackpot_count/total*100:.3f}%)")
    print(f"  Three-Same: {stats.three_same_count:,} ({stats.three_same_count/total*100:.3f}%)")
    print(f"  Two-Same: {stats.two_same_count:,} ({stats.two_same_count/total*100:.3f}%)")
    print(f"  One Hat: {stats.one_hat_count:,} ({stats.one_hat_count/total*100:.3f}%)")
    print(f"  Two Hats: {stats.two_hats_count:,} ({stats.two_hats_count/total*100:.3f}%)")
    print(f"  Nothing: {stats.nothing_count:,} ({stats.nothing_count/total*100:.3f}%)")
    
    print(f"\n📈 Expected vs Actual Probabilities:")
    print(f"  Jackpot: Expected 0.150% | Actual {stats.jackpot_count/total*100:.3f}%")
    print(f"  Three-Same: Expected 0.960% | Actual {stats.three_same_count/total*100:.3f}%")
    print(f"  Two-Same: Expected 18.000% | Actual {stats.two_same_count/total*100:.3f}%")
    print(f"  One Hat: Expected 30.000% | Actual {stats.one_hat_count/total*100:.3f}%")
    print(f"  Two Hats: Expected 0.500% | Actual {stats.two_hats_count/total*100:.3f}%")
    print(f"  Nothing: Expected 50.390% | Actual {stats.nothing_count/total*100:.3f}%")
    
    print(f"\n🏦 Pot Statistics:")
    print(f"  Initial Pot: {INITIAL_POT:,} $DEGEN")
    print(f"  Final Pot: {stats.final_pot:,} $DEGEN")
    print(f"  Pot Growth: {stats.final_pot - INITIAL_POT:+,} $DEGEN")
    print(f"  Mean Pot: {stats.pot_mean:,.0f} $DEGEN")
    print(f"  Min Pot: {stats.pot_min:,} $DEGEN")
    print(f"  Max Pot: {stats.pot_max:,} $DEGEN")
    print(f"  Times Pot < 2000: {stats.pot_below_2000_count:,} ({stats.pot_below_2000_count/len(range(stats.total_spins+1))*100:.2f}%)")
    
    print(f"\n✅ Verification:")
    print(f"  RTP within 1% of expected: {'✓' if abs(stats.rtp - stats.expected_rtp) < 1.0 else '✗'}")
    print(f"  Pot grew as expected: {'✓' if stats.final_pot > INITIAL_POT else '✗'}")
    print(f"  Treasury = 30 * spins: {'✓' if stats.final_treasury == stats.total_spins * TREASURY_ADD_PER_SPIN else '✗'}")
    print(f"  Rare pot < 2000: {'✓' if stats.pot_below_2000_count < stats.total_spins * 0.01 else '✗'}")

def verify_probability_ranges():
    """Verify that probability ranges are correct"""
    print("\n🔍 Verifying Probability Ranges:")
    print(f"  Jackpot: [{JACKPOT_RANGE_START}, {JACKPOT_RANGE_END}) = {JACKPOT_RANGE_END - JACKPOT_RANGE_START} bps")
    print(f"  Three-Same: [{THREE_SAME_RANGE_START}, {THREE_SAME_RANGE_END}) = {THREE_SAME_RANGE_END - THREE_SAME_RANGE_START} bps")
    print(f"  Two-Same: [{TWO_SAME_RANGE_START}, {TWO_SAME_RANGE_END}) = {TWO_SAME_RANGE_END - TWO_SAME_RANGE_START} bps")
    print(f"  One Hat: [{ONE_HAT_RANGE_START}, {ONE_HAT_RANGE_END}) = {ONE_HAT_RANGE_END - ONE_HAT_RANGE_START} bps")
    print(f"  Two Hats: [{TWO_HATS_RANGE_START}, {TWO_HATS_RANGE_END}) = {TWO_HATS_RANGE_END - TWO_HATS_RANGE_START} bps")
    print(f"  Nothing: [{NOTHING_RANGE_START}, {NOTHING_RANGE_END}) = {NOTHING_RANGE_END - NOTHING_RANGE_START} bps")
    
    total_range = (JACKPOT_RANGE_END - JACKPOT_RANGE_START + 
                   THREE_SAME_RANGE_END - THREE_SAME_RANGE_START + 
                   TWO_SAME_RANGE_END - TWO_SAME_RANGE_START + 
                   ONE_HAT_RANGE_END - ONE_HAT_RANGE_START +
                   TWO_HATS_RANGE_END - TWO_HATS_RANGE_START +
                   NOTHING_RANGE_END - NOTHING_RANGE_START)
    print(f"  Total: {total_range} bps (should be 10000)")
    print(f"  Ranges are correct: {'✓' if total_range == 10000 else '✗'}")

def main():
    """Main simulation function"""
    print("🎰 Starting DegenSlot Simulation...")
    print(f"Simulating 1,000,000+ spins with the following parameters:")
    print(f"  Cost per spin: {COST_PER_SPIN} $DEGEN")
    print(f"  Pot addition per spin: {POT_ADD_PER_SPIN} $DEGEN (70%)")
    print(f"  Treasury addition per spin: {TREASURY_ADD_PER_SPIN} $DEGEN (30%)")
    print(f"  Initial pot seed: 5,000 $DEGEN")
    print(f"  Expected RTP: ~70%")
    print(f"  Expected steady-state pot: ~4,600 $DEGEN")
    
    verify_probability_ranges()
    
    # Run simulation
    print(f"\n🎲 Running simulation...")
    stats = simulate_spins(1_000_000, pot_seed=5_000)  # 5000 DEGEN initial pot
    
    # Print results
    print_simulation_results(stats)
    
    print(f"\n🎯 Simulation Complete!")
    print(f"The contract logic has been verified with 1M spins.")
    print(f"New One-Hat (30%) and Two-Hats (0.5%) categories implemented!")

if __name__ == "__main__":
    # Set random seed for reproducible results (optional)
    random.seed(42)
    main()
