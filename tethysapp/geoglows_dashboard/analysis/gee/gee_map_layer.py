import ee


class GEEMapLayer:
    def __init__(self, area):
        self.CHIRPS=ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        self.AOI = ee.FeatureCollection(area)  # the area of interest
        self.SPImonthlyVis = {
            "opacity": 1,
            "bands": ["SPI"],
            "min": -4,
            "max": 4,
            "palette": ["d53e4f", "fc8d59", "fee08b", "ffffbf", "e6f598", "99d594", "3288bd"]
        }

        self.SPI16DayVis = {
            "opacity": 1,
            "bands": ["SPI_16Days"],
            "min": -4,
            "max": 4,
            "palette": ["d53e4f", "fc8d59", "fee08b", "ffffbf", "e6f598", "99d594", "3288bd"]
        }
        
    def calculate_date_list(self):
        # a list of months between the first and last image
        firstImage = ee.Date(ee.List(self.CHIRPS.get('date_range')).get(0));
        latestImage = ee.Date(self.CHIRPS.limit(1, 'system:time_start',  False).first().get('system:time_start'))
        timedif = (latestImage.difference(firstImage, 'month'))
        eelist = ee.List.sequence(0, timedif)
        
        def map_over_list(month):
            zero = ee.Number(0)  # Is needed to subtract month
            # Results in negative counting in the list (from latest image backwards) in the steps provided by the user
            delta = zero.subtract(month)
            # Advance one day to include the latest image (starts counting at 00:00 o'clock)
            latestDate = latestImage.advance(1, 'day')
            # Returns a list of dates counted from latest date backwards
            return latestDate.advance(delta, 'month')
        
        timeListDate = eelist.map(map_over_list)
        return timeListDate
    
    # Calculate the SPI
    @staticmethod
    def SpiSmaller12(summedChirpsCollection):
        # Calculate Statistics
        def calculate_stats(toStats):
            startDOY = ee.Date(toStats.get('system:time_start')).getRelative('day', 'year')
            endDOY = ee.Date(toStats.get('system:time_end')).getRelative('day', 'year')
            collectionForStats = summedChirpsCollection.filter(ee.Filter.calendarRange(startDOY, endDOY, 'day_of_year')) \
                .reduce(ee.Reducer.stdDev().combine(ee.Reducer.mean(), None, True))
            return toStats.addBands(collectionForStats)

        # Calculate SPI
        def calculate_SPI(toSPI):
            bandForSPI = toSPI.select(['precipitation'], ['SPI'])
            calc = toSPI.expression('(precipitation - mean) / stdDev', {
                'precipitation': bandForSPI,
                'mean': toSPI.select('precipitation_mean'),
                'stdDev': toSPI.select('precipitation_stdDev')
            })
            return toSPI.addBands(calc)

        stats = summedChirpsCollection.map(calculate_stats)
        return  stats.map(calculate_SPI)
    
    @staticmethod
    def get_tile_url(ee_image, vis_params):
        map_id_dict = ee.Image(ee_image).getMapId(vis_params)
        return map_id_dict['tile_fetcher'].url_format
        
    def main(self):
        timeListDate = self.calculate_date_list()
        CHIRPS = self.CHIRPS
        AOI = self.AOI
        
        def calculate_precipitation_sum(monthly_sum):
          startTime = ee.Date(monthly_sum).advance(-1, 'month')
          endTime = ee.Date(monthly_sum)
          filteredCHIRPS = CHIRPS.filterDate(startTime, endTime)
          clippedCHIRPS = filteredCHIRPS.map(lambda clip: clip.clip(AOI))
          imageAmount = clippedCHIRPS.size()
          summedCollection = clippedCHIRPS.sum().set({
              'Used_Images': imageAmount,
              'Start_Date': ee.Date(filteredCHIRPS.first().get('system:time_start')),
              'End_Date': ee.Date(filteredCHIRPS.limit(1, 'system:time_end', False).first().get('system:time_end')),
              'system:time_start': filteredCHIRPS.first().get('system:time_start'),  # Add start date to new image
              'system:time_end': filteredCHIRPS.limit(1, 'system:time_end', False).first().get('system:time_end')  # Add end date to new image
          })
          time = ee.Date(summedCollection.get('system:time_end')).difference(ee.Date(summedCollection.get('system:time_start')), 'month').round()
          summedImage = summedCollection.set({'Observed_Months': time})
          return ee.Algorithms.If(time.gte(1), summedImage)

        PrecipitationSum = ee.ImageCollection.fromImages(timeListDate.map(calculate_precipitation_sum))
        summedChirpsCollection = ee.ImageCollection(PrecipitationSum.copyProperties(self.CHIRPS))
        SPI = ee.ImageCollection(GEEMapLayer.SpiSmaller12(summedChirpsCollection))
        return GEEMapLayer.get_tile_url(SPI.limit(1, 'system:time_start', False).first(), self.SPImonthlyVis)