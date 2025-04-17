Feature: Synchronize Cache

Scenario: Successful Synchronization of Created Files
Given the files "File1" and "File2" don't exist in cache
And the files "File1" and "File2" exist in the vault
When I load the plugin
Then should see that "File1" and "File2" are in the cache

Scenario: Successful Synchronization of Deleted Files
Given the files "File1" and "File2" exist in cache
And the files "File1" and "File2" don't exist in the vault
When I load the plugin
Then I should no longer see "File1" and "File2" in the cache

Scenario: Successful Deletion of Files that are past the exclusion date
Given "File1" and "File2" exist in cache
And "File1" and "File2" exist in the vault
And "File1" and "File2" are marked as excluded
And "File1" and "File2" are past the exclusion date
When I load the plugin
Then I should no longer see "File1" and "File2" in the cache
