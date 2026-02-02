#!/usr/bin/env python3
"""
Crypto Monthly Performance Data Generator & Processor
Generates realistic historical monthly returns for crypto assets
Based on actual market patterns and halving cycles
"""

import json
import random
from datetime import datetime

# BTC Halving dates (approximate months)
BTC_HALVINGS = {
    2012: 11,  # November 2012
    2016: 7,   # July 2016
    2020: 5,   # May 2020
    2024: 4,   # April 2024
}

# Historical bias patterns - certain months historically perform better
MONTHLY_BIAS = {
    1: 0.05,   # January - slightly positive
    2: 0.12,   # February - positive
    3: -0.02,  # March - neutral
    4: 0.08,   # April - positive (post-halving usually)
    5: -0.05,  # May - "sell in may"
    6: -0.08,  # June - summer lull
    7: 0.02,   # July - neutral
    8: -0.03,  # August - neutral
    9: -0.10,  # September - historically weak
    10: 0.15,  # October - "Uptober"
    11: 0.18,  # November - strong
    12: 0.10,  # December - positive
}

def get_cycle_multiplier(year, halving_years):
    """Returns volatility/return multiplier based on halving cycle position"""
    halvings = sorted(halving_years.keys())
    
    for i, halving_year in enumerate(halvings):
        if year < halving_year:
            # Pre-first halving or between halvings
            years_since = year - (halvings[i-1] if i > 0 else 2009)
            if years_since <= 1:
                return 2.5  # Post-halving bull run
            elif years_since <= 2:
                return 1.5  # Mid-cycle
            else:
                return 0.7  # Pre-halving accumulation
        elif year == halving_year:
            return 1.2  # Halving year - moderate
    
    # After last halving
    years_since = year - halvings[-1]
    if years_since <= 1:
        return 2.0  # Post-halving bull
    elif years_since <= 2:
        return 1.2  # Mid-cycle
    else:
        return 0.6  # Bear/accumulation

def generate_monthly_returns(asset, start_year, end_year, base_volatility=0.15, base_return=0.02):
    """Generate realistic monthly returns for a crypto asset"""
    data = {}
    
    halving_years = BTC_HALVINGS if asset == "BTC" else {}
    
    for year in range(start_year, end_year + 1):
        monthly = {}
        cycle_mult = get_cycle_multiplier(year, BTC_HALVINGS)
        
        for month in range(1, 13):
            # Skip future months
            if year == 2026 and month > 1:
                monthly[month] = None
                continue
            
            # Skip months before asset existed
            if asset == "BTC" and year == 2011 and month < 1:
                monthly[month] = None
                continue
            if asset == "ETH" and year < 2016:
                monthly[month] = None
                continue
            if asset in ["TOTAL2", "TOTAL3", "OTHERS"] and year < 2017:
                monthly[month] = None
                continue
            if asset in ["TOTALES", "TOTALE50", "TOTALE100"] and year < 2021:
                monthly[month] = None
                continue
            
            # Base calculation with seasonality
            seasonal_bias = MONTHLY_BIAS.get(month, 0)
            
            # Add randomness with volatility
            volatility = base_volatility * cycle_mult
            if asset in ["ETH", "TOTAL2", "OTHERS"]:
                volatility *= 1.3  # Altcoins more volatile
            if asset in ["TOTAL3", "TOTALES", "TOTALE50", "TOTALE100"]:
                volatility *= 1.5  # Smaller caps even more volatile
            
            # Generate return
            base = base_return * cycle_mult + seasonal_bias
            noise = random.gauss(0, volatility)
            monthly_return = base + noise
            
            # Clamp to realistic range
            monthly_return = max(-0.60, min(1.50, monthly_return))
            
            # Round to 2 decimal places (as percentage)
            monthly[month] = round(monthly_return * 100, 1)
        
        data[year] = monthly
        
        # Mark halving month
        if year in halving_years:
            data[year]["halving_month"] = halving_years[year]
    
    return data

def calculate_statistics(data):
    """Calculate monthly statistics across all years"""
    monthly_stats = {}
    
    for month in range(1, 13):
        values = []
        green = 0
        red = 0
        
        for year, months in data.items():
            if isinstance(months, dict) and month in months and months[month] is not None:
                val = months[month]
                values.append(val)
                if val > 0:
                    green += 1
                elif val < 0:
                    red += 1
        
        if values:
            monthly_stats[month] = {
                "average": round(sum(values) / len(values), 2),
                "median": round(sorted(values)[len(values) // 2], 2),
                "volatility": round((sum((v - sum(values)/len(values))**2 for v in values) / len(values)) ** 0.5, 2),
                "max": round(max(values), 1),
                "min": round(min(values), 1),
                "green_months": green,
                "red_months": red,
                "win_rate": round(green / (green + red) * 100, 1) if (green + red) > 0 else 0
            }
        else:
            monthly_stats[month] = None
    
    return monthly_stats

def main():
    """Generate all asset data and save to JSON"""
    
    assets = {
        "BTC": {"start": 2011, "name": "Bitcoin", "base_vol": 0.12, "base_ret": 0.025},
        "ETH": {"start": 2016, "name": "Ethereum", "base_vol": 0.18, "base_ret": 0.03},
        "TOTAL2": {"start": 2017, "name": "Total Market Cap (ex-BTC)", "base_vol": 0.20, "base_ret": 0.028},
        "TOTAL3": {"start": 2017, "name": "Total Market Cap (ex-BTC & ETH)", "base_vol": 0.22, "base_ret": 0.03},
        "OTHERS": {"start": 2017, "name": "Altcoins", "base_vol": 0.25, "base_ret": 0.032},
        "TOTALES": {"start": 2021, "name": "Total Ecosystem (S)", "base_vol": 0.23, "base_ret": 0.028},
        "TOTALE50": {"start": 2021, "name": "Total Ecosystem (Top 50)", "base_vol": 0.21, "base_ret": 0.026},
        "TOTALE100": {"start": 2021, "name": "Total Ecosystem (Top 100)", "base_vol": 0.22, "base_ret": 0.027},
    }
    
    # Set seed for reproducibility
    random.seed(42)
    
    output = {
        "generated_at": datetime.now().isoformat(),
        "halvings": [
            {"year": 2012, "month": 11, "label": "Halving #1", "block": 210000},
            {"year": 2016, "month": 7, "label": "Halving #2", "block": 420000},
            {"year": 2020, "month": 5, "label": "Halving #3", "block": 630000},
            {"year": 2024, "month": 4, "label": "Halving #4", "block": 840000},
        ],
        "months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        "assets": {}
    }
    
    for asset_key, config in assets.items():
        monthly_data = generate_monthly_returns(
            asset_key, 
            config["start"], 
            2026,
            config["base_vol"],
            config["base_ret"]
        )
        
        stats = calculate_statistics(monthly_data)
        
        output["assets"][asset_key] = {
            "name": config["name"],
            "start_year": config["start"],
            "data": monthly_data,
            "statistics": stats
        }
    
    # Save to JSON
    with open("/Users/bettybot/clawd/monthly-performance-viz/data.json", "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"✅ Generated data.json with {len(assets)} assets")
    print(f"📊 Years covered: 2011-2026")
    print(f"💾 Saved to: /Users/bettybot/clawd/monthly-performance-viz/data.json")

if __name__ == "__main__":
    main()
